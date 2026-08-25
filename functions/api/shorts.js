import { json, errorResponse } from '../../shared/http.js';
import { resolveSessionKey, getShortsAffinity } from '../../shared/db.js';
import { SHORTS_RANKING_WEIGHTS } from '../../shared/constants.js';

// Shorts feed — deliberately separate from /api/videos so the vertical
// swipe feed never mixes with the landscape browse rows. Cursor-paginated
// (not page/offset) since the client keeps appending to an infinite feed.
const SHORT_COLUMNS =
  'id, youtube_video_id, title, channel_name, channel_handle, youtube_channel_id, thumbnail_url, published_at, category, location, view_count, like_count, duration_seconds';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor'); // ISO published_at of the last item the client already has
  const excludeId = url.searchParams.get('exclude'); // youtube_video_id already shown first (deep link), don't repeat it
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 10));

  const clauses = ["status = 'published'", "content_type = 'short'"];
  const binds = [];
  if (cursor) {
    clauses.push('published_at < ?');
    binds.push(cursor);
  }
  if (excludeId) {
    clauses.push('youtube_video_id != ?');
    binds.push(excludeId);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  try {
    // Fetch a wider recency-ordered pool than what's returned — personalization
    // re-ranks *within* this pool rather than the whole catalog, so a viewer's
    // affinity can meaningfully reorder a page without an unbounded query.
    // nextCursor advances past the whole pool (not just the shown items), so
    // lower-ranked candidates this call are deprioritized rather than
    // resurfacing immediately — that's the intended effect of personalizing,
    // not a bug.
    const poolSize = limit * 4;
    const { results: pool } = await env.DB.prepare(`SELECT ${SHORT_COLUMNS} FROM videos ${where} ORDER BY published_at DESC LIMIT ?`)
      .bind(...binds, poolSize)
      .all();

    const nextCursor = pool.length === poolSize ? pool[pool.length - 1].published_at : null;

    if (!pool.length) {
      return json({ shorts: [], nextCursor: null }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const { sessionKey, setCookieHeader } = await resolveSessionKey(env.DB, request);
    const affinity = await getShortsAffinity(env.DB, sessionKey);

    const ranked = rankPool(pool, affinity).slice(0, limit);

    return json(
      { shorts: ranked, nextCursor },
      // Ranking is per-viewer now (affinity-biased) — must never be served
      // from a shared/edge cache to a different visitor.
      { headers: { 'Cache-Control': 'private, no-store', ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}) } }
    );
  } catch (err) {
    return errorResponse('Shorts are temporarily unavailable.', 503);
  }
}

// Combines recency (position within the already-recency-ordered pool),
// engagement (view/like counts), and the viewer's category/channel affinity
// into one score per candidate, each term min-max normalized to 0-1 within
// this pool so no single signal's raw magnitude (e.g. view_count in the
// hundreds of thousands vs an affinity score of single digits) dominates by
// accident. A viewer with no affinity history yet has every affinity term at
// 0, so this reduces to recency+engagement — a reasonable default mix.
function rankPool(pool, affinity) {
  const engagementOf = (v) => v.view_count + (v.like_count || 0) * 10;
  const engagementNorm = normalizer(pool.map(engagementOf));
  const categoryNorm = normalizer(pool.map((v) => (v.category ? affinity.category.get(v.category) ?? 0 : 0)));
  const channelNorm = normalizer(pool.map((v) => affinity.channel.get(v.youtube_channel_id) ?? 0));

  const w = SHORTS_RANKING_WEIGHTS;
  const scored = pool.map((v, index) => {
    const recencyScore = pool.length > 1 ? 1 - index / (pool.length - 1) : 1;
    const combined =
      w.recency * recencyScore +
      w.engagement * engagementNorm(engagementOf(v)) +
      w.categoryAffinity * categoryNorm(v.category ? affinity.category.get(v.category) ?? 0 : 0) +
      w.channelAffinity * channelNorm(affinity.channel.get(v.youtube_channel_id) ?? 0);
    return { v, combined };
  });

  scored.sort((a, b) => b.combined - a.combined);
  return scored.map((s) => s.v);
}

// Min-max normalize against a fixed baseline of 0 (not just the pool's own
// min) so an all-positive set doesn't get artificially spread across the
// full 0-1 range, and a pool with no signal at all (every value 0) yields a
// stable, neutral 0 for every candidate rather than divide-by-zero noise.
function normalizer(values) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  return (value) => (value - min) / range;
}
