import { cacheableJson, errorResponse } from '../../../shared/http.js';

const VIDEO_COLUMNS =
  'v.id, v.youtube_video_id, v.title, v.description, v.thumbnail_url, v.channel_name, v.channel_handle, v.youtube_channel_id, v.published_at, v.category, v.location, v.tags, v.duration_seconds, v.view_count, v.featured, v.trending, c.slug AS channel_slug';

// :id is the YOUTUBE video ID (matches the public /watch/:id URL scheme, not
// our internal uuid) — a video that exists but isn't 'published' 404s here
// exactly like it doesn't exist, so the admin review queue is never
// browsable through the public API.
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    // channel_slug (nullable — LEFT JOIN, since a channel can be approved
    // without a slug in principle, or a video's channel row could be
    // missing) lets js/watch.js build a real /:slug creator link directly,
    // instead of always falling back to the /creator/:id redirect route —
    // see js/api.js's creatorUrl().
    const video = await env.DB.prepare(
      `SELECT ${VIDEO_COLUMNS} FROM videos v
       LEFT JOIN channels c ON c.youtube_channel_id = v.youtube_channel_id
       WHERE v.youtube_video_id = ? AND v.status = 'published'`
    )
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
