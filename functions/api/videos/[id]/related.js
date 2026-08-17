import { json, cacheableJson, errorResponse } from '../../../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, thumbnail_url, channel_name, published_at, category, location, duration_seconds, view_count';

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const video = await env.DB.prepare(`SELECT category, location FROM videos WHERE youtube_video_id = ? AND status = 'published'`)
      .bind(params.id)
      .first();
    if (!video) return json({ related: [] });

    const { results } = await env.DB
      .prepare(
        `SELECT ${VIDEO_COLUMNS} FROM videos
         WHERE status = 'published' AND youtube_video_id != ? AND (category = ? OR location = ?)
         ORDER BY (category = ?) DESC, published_at DESC LIMIT 12`
      )
      .bind(params.id, video.category, video.location, video.category)
      .all();

    return cacheableJson({ related: results });
  } catch (err) {
    return errorResponse('Related videos are temporarily unavailable.', 503);
  }
}
