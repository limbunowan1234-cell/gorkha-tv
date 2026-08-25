import { cacheableJson, errorResponse } from '../../../shared/http.js';

const CREATOR_COLUMNS =
  'id, youtube_channel_id, channel_name, channel_handle, channel_url, thumbnail_url, description, location, category, verified, featured, submitted_by_user_id';
const VIDEO_COLUMNS = 'id, youtube_video_id, title, thumbnail_url, published_at, category, location, duration_seconds, view_count';

// :id is the YOUTUBE channel ID (matches the public /creator/:id URL scheme).
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const creator = await env.DB.prepare(`SELECT ${CREATOR_COLUMNS} FROM channels WHERE youtube_channel_id = ? AND status = 'approved'`)
      .bind(params.id)
      .first();
    if (!creator) return errorResponse('Creator not found.', 404);

    const { results: videos } = await env.DB
      .prepare(
        `SELECT ${VIDEO_COLUMNS} FROM videos
         WHERE youtube_channel_id = ? AND status = 'published' AND (content_type IS NULL OR content_type != 'short')
         ORDER BY published_at DESC LIMIT 48`
      )
      .bind(params.id)
      .all();

    // Expose only whether it's claimed, never the owner's internal user id.
    const claimed = !!creator.submitted_by_user_id;
    delete creator.submitted_by_user_id;

    return cacheableJson({ creator: { ...creator, claimed }, videos }, 120);
  } catch (err) {
    return errorResponse('This creator profile is temporarily unavailable.', 503);
  }
}
