import { json, cacheableJson, errorResponse } from '../../../../shared/http.js';

// Includes like_count/youtube_channel_id for internal ranking — stripped
// from the final response below to keep the same public shape as before.
const VIDEO_COLUMNS_SQL =
  'id, youtube_video_id, title, thumbnail_url, channel_name, published_at, category, location, duration_seconds, view_count, like_count, youtube_channel_id';

// Landscape only — this list doubles as the autoplay "up next" queue
// (gorkhatv2/js/watch.js's relatedVideos[0]), so a Short landing here would
// both look wrong in the sidebar and make a bad autoplay jump.
const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";

// Each candidate pool below is a small, independently-LIMIT-bounded query —
// deliberately three separate small queries, not one combined SQL
// statement with an OR/UNION. Confirmed directly against production D1:
// a single-query version (relevance_tier CASE + channel_rank window
// function over a UNION of channel/category/location matches) still reads
// thousands of rows whenever the current video's category or location is a
// common one — location='Darjeeling' alone matches ~42% of the entire
// catalog, and SQLite's window-function/UNION-dedup machinery has to see
// every matching row to rank it, no matter how the SQL is restructured.
// Three small, LIMIT-bounded, independently-indexed queries (verified:
// ~150-200 rows read total in the worst case, vs 5,000-11,000+ before) plus
// a cheap JS merge over that small set sidesteps the problem entirely.
const CHANNEL_POOL_LIMIT = 20;
const CATEGORY_POOL_LIMIT = 60;
const LOCATION_POOL_LIMIT = 60;

// "Related" used to just mean same-category-or-location, newest first —
// no different from browsing that category, and prone to surfacing
// something barely-watched over something genuinely good. Real relatedness
// has a hierarchy, most specific first: the artist's own other work in the
// SAME genre ("more songs by them", the actual "mix" feel — plain
// same-channel alone isn't enough, since a channel that's mostly pranks
// with one music upload would otherwise surface pranks after a song,
// confirmed directly), then the artist's other content generally, then
// other channels sharing both category and location, then either alone —
// each tier ranked by actual engagement, not upload date.
//
// Ranking by relevance_tier alone let one prolific artist's whole catalog
// fill the entire list before any other channel appeared at all — direct
// user feedback: "up next" kept giving the same artist only, wanted a mix.
// The round-robin below (one candidate per channel per round) fixes this:
// every channel's #1 candidate is picked ahead of any channel's #2, so with
// >=12 distinct candidate channels the list is one video per artist, still
// ordered by tier/engagement within each round — the current video's own
// artist still leads (their best tier-4 match wins round 1), it just
// doesn't crowd out everyone else the way a flat sort did.
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const video = await env.DB.prepare(
      `SELECT youtube_channel_id, category, location FROM videos WHERE youtube_video_id = ? AND status = 'published'`
    )
      .bind(params.id)
      .first();
    if (!video) return json({ related: [] });

    const emptyResult = Promise.resolve({ results: [] });

    const [channelRes, categoryRes, locationRes] = await Promise.all([
      env.DB
        .prepare(
          `SELECT ${VIDEO_COLUMNS_SQL} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND youtube_video_id != ?1 AND youtube_channel_id = ?2
           ORDER BY (view_count + COALESCE(like_count, 0) * 10) DESC LIMIT ${CHANNEL_POOL_LIMIT}`
        )
        .bind(params.id, video.youtube_channel_id)
        .all(),
      video.category
        ? env.DB
            .prepare(
              `SELECT ${VIDEO_COLUMNS_SQL} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND youtube_video_id != ?1 AND category = ?2
               ORDER BY published_at DESC LIMIT ${CATEGORY_POOL_LIMIT}`
            )
            .bind(params.id, video.category)
            .all()
        : emptyResult,
      video.location
        ? env.DB
            .prepare(
              `SELECT ${VIDEO_COLUMNS_SQL} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND youtube_video_id != ?1 AND location = ?2
               ORDER BY published_at DESC LIMIT ${LOCATION_POOL_LIMIT}`
            )
            .bind(params.id, video.location)
            .all()
        : emptyResult,
    ]);

    // Merge + dedupe by youtube_video_id (a video can match more than one
    // pool — keep the higher tier it earns), then rank — all in JS now,
    // over a small (<= ~140-row) candidate set instead of SQL over the
    // full matching set.
    const byId = new Map();
    const upsert = (v) => {
      const tier =
        v.youtube_channel_id === video.youtube_channel_id && v.category === video.category
          ? 4
          : v.youtube_channel_id === video.youtube_channel_id
            ? 3
            : v.category === video.category && v.location === video.location
              ? 2
              : v.category === video.category || v.location === video.location
                ? 1
                : 0;
      const existing = byId.get(v.youtube_video_id);
      if (!existing || tier > existing._tier) byId.set(v.youtube_video_id, { ...v, _tier: tier });
    };
    channelRes.results.forEach(upsert);
    categoryRes.results.forEach(upsert);
    locationRes.results.forEach(upsert);

    const engagement = (v) => (v.view_count || 0) + (v.like_count || 0) * 10;
    const candidates = [...byId.values()].sort(
      (a, b) => b._tier - a._tier || engagement(b) - engagement(a) || (b.published_at > a.published_at ? 1 : -1)
    );

    // Round-robin by channel, in the order each channel's best candidate
    // appears in the already tier/engagement-sorted list above.
    const byChannel = new Map();
    for (const v of candidates) {
      const list = byChannel.get(v.youtube_channel_id);
      if (list) list.push(v);
      else byChannel.set(v.youtube_channel_id, [v]);
    }
    const ranked = [];
    for (let round = 0; ranked.length < 12 && round < CATEGORY_POOL_LIMIT; round++) {
      let any = false;
      for (const list of byChannel.values()) {
        if (list[round]) {
          ranked.push(list[round]);
          any = true;
          if (ranked.length >= 12) break;
        }
      }
      if (!any) break;
    }

    const related = ranked.map(({ _tier, youtube_channel_id, like_count, ...rest }) => rest);

    return cacheableJson({ related });
  } catch (err) {
    return errorResponse('Related videos are temporarily unavailable.', 503);
  }
}
