import { cacheableJson, errorResponse } from '../../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, description, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, tags, duration_seconds, view_count, featured, trending';

// :id is the YOUTUBE video ID (matches the public /watch/:id URL scheme, not
// our internal uuid) — a video that exists but isn't 'published' 404s here
// exactly like it doesn't exist, so the admin review queue is never
// browsable through the public API.
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const video = await env.DB.prepare(`SELECT ${VIDEO_COLUMNS} FROM videos WHERE youtube_video_id = ? AND status = 'published'`)
      .bind(params.id)
      .first();
    if (!video) return errorResponse('Video not found.', 404);
    return cacheableJson({ video: { ...video, tags: safeParseTags(video.tags) } });
  } catch (err) {
    return errorResponse('This video is temporarily unavailable.', 503);
  }
}

function safeParseTags(tags) {
  try {
    return JSON.parse(tags || '[]');
  } catch {
    return [];
  }
}
