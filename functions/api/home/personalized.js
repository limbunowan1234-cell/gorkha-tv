import { json } from '../../../shared/http.js';
import { resolveSessionKey, getContinueWatching, getTopVideoAffinity } from '../../../shared/db.js';

const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const VIDEO_COLUMNS =
  'id, youtube_video_id, title, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, duration_seconds, view_count';

// Personalized homepage rows ("Continue Watching" / "Because You Liked") —
// deliberately a *separate* endpoint from /api/home, which is edge-cached
// and shared across every visitor (cacheableJson). Baking per-viewer data
// into that response would leak one viewer's watch history to whoever else
// hits the same cached response next — same reasoning as why /api/shorts is
// marked private/no-store. This endpoint is fetched as a second request by
// gorkhatv2/js/home.js, and must never be cached at any shared layer.
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const { sessionKey, setCookieHeader } = await resolveSessionKey(env.DB, request);

    const [continueWatching, { topChannel, topCategory }] = await Promise.all([
      getContinueWatching(env.DB, sessionKey, 12),
      getTopVideoAffinity(env.DB, sessionKey),
    ]);

    let becauseYouLiked = null;
    if (topChannel) {
      const { results } = await env.DB.prepare(
        `SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND youtube_channel_id = ? ORDER BY published_at DESC LIMIT 12`
      )
        .bind(topChannel.value)
        .all();
      if (results.length) {
        becauseYouLiked = { label: `Because you watched ${results[0].channel_name || 'this creator'}`, items: results };
      }
    }
    if (!becauseYouLiked && topCategory) {
      const { results } = await env.DB.prepare(
        `SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND category = ? ORDER BY (view_count + COALESCE(like_count, 0) * 10) DESC LIMIT 12`
      )
        .bind(topCategory.value)
        .all();
      if (results.length) {
        const label = topCategory.value.charAt(0).toUpperCase() + topCategory.value.slice(1);
        becauseYouLiked = { label: `Because you like ${label}`, items: results };
      }
    }

    return json(
      { continueWatching, becauseYouLiked },
      { headers: { 'Cache-Control': 'private, no-store', ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}) } }
    );
  } catch (err) {
    // Best-effort personalization — the rest of the homepage must never
    // depend on this succeeding.
    return json({ continueWatching: [], becauseYouLiked: null }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
