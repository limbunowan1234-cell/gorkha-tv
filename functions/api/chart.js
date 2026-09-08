import { cacheableJson } from '../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, description, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, duration_seconds, view_count';

// Same constants as functions/api/home.js — redefined here rather than
// shared, matching this codebase's existing per-route-constant convention
// (VIDEO_COLUMNS itself is already duplicated per-route the same way).
const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";
const ENGAGEMENT_EXPR = '(view_count + COALESCE(like_count, 0) * 10)';

// "Top 100 Hills Hits" — a flat, unpartitioned ranking of the whole `music`
// category (unlike functions/api/home.js's per-category Top 10, which is
// partitioned across every category). Read-only, D1-only, same shape as
// every other public read endpoint.
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      `SELECT ${VIDEO_COLUMNS} FROM videos
       WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND category = 'music'
       ORDER BY ${ENGAGEMENT_EXPR} DESC, published_at DESC
       LIMIT 100`
    ).all();

    return cacheableJson({ chart: results }, 600);
  } catch (err) {
    return cacheableJson({ chart: [], error: 'Chart is temporarily unavailable.' }, 60);
  }
}
