import { json, cacheableJson, errorResponse } from '../../../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, thumbnail_url, channel_name, published_at, category, location, duration_seconds, view_count';

// Landscape only — this list doubles as the autoplay "up next" queue
// (gorkhatv2/js/watch.js's relatedVideos[0]), so a Short landing here would
// both look wrong in the sidebar and make a bad autoplay jump.
const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const ENGAGEMENT_EXPR = '(view_count + COALESCE(like_count, 0) * 10)';

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
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const video = await env.DB.prepare(
      `SELECT youtube_channel_id, category, location FROM videos WHERE youtube_video_id = ? AND status = 'published'`
    )
      .bind(params.id)
      .first();
    if (!video) return json({ related: [] });

    const { results } = await env.DB
      .prepare(
        `SELECT ${VIDEO_COLUMNS} FROM (
           SELECT *,
             CASE
               WHEN youtube_channel_id = ?1 AND category = ?2 THEN 4
               WHEN youtube_channel_id = ?1 THEN 3
               WHEN category = ?2 AND location = ?3 THEN 2
               WHEN category = ?2 OR location = ?3 THEN 1
               ELSE 0
             END AS relevance_tier
           FROM videos
           WHERE status = 'published' AND ${NOT_SHORT} AND youtube_video_id != ?4
             AND (youtube_channel_id = ?1 OR category = ?2 OR location = ?3)
         )
         ORDER BY relevance_tier DESC, ${ENGAGEMENT_EXPR} DESC, published_at DESC
         LIMIT 12`
      )
      .bind(video.youtube_channel_id, video.category, video.location, params.id)
      .all();

    return cacheableJson({ related: results });
  } catch (err) {
    return errorResponse('Related videos are temporarily unavailable.', 503);
  }
}
