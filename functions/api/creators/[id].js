import { cacheableJson, errorResponse } from '../../../shared/http.js';
import { getFollowerCount } from '../../../shared/db.js';

const CREATOR_COLUMNS =
  'id, youtube_channel_id, channel_name, channel_handle, channel_url, thumbnail_url, description, location, category, verified, featured, submitted_by_user_id, slug';
const VIDEO_COLUMNS = 'id, youtube_video_id, title, thumbnail_url, published_at, category, location, duration_seconds, view_count';

// :id is either the channel's root-level slug (the public /:slug URL scheme)
// or, for back-compat, its raw YouTube channel ID — never ambiguous, since a
// youtube_channel_id is always "UC" + 22 chars and never matches a
// lowercase-only slug.
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const creator = await env.DB.prepare(
      `SELECT ${CREATOR_COLUMNS} FROM channels WHERE (youtube_channel_id = ? OR slug = ?) AND status = 'approved'`
    )
      .bind(params.id, params.id)
      .first();
    if (!creator) return errorResponse('Creator not found.', 404);

    const { results: videos } = await env.DB
      .prepare(
        `SELECT ${VIDEO_COLUMNS} FROM videos
         WHERE youtube_channel_id = ? AND status = 'published' AND (content_type IS NULL OR content_type != 'short')
         ORDER BY published_at DESC LIMIT 48`
      )
      .bind(creator.youtube_channel_id)
      .all();

    // Expose only whether it's claimed, never the owner's internal user id.
    const claimed = !!creator.submitted_by_user_id;
    delete creator.submitted_by_user_id;

    // Follower count tolerates this response's 120s shared cache fine; a
    // per-viewer "am I following" flag must not go here — see
    // gorkhatv2/js/creator.js, which resolves that client-side instead.
    const followerCount = await getFollowerCount(env.DB, creator.id);

    return cacheableJson({ creator: { ...creator, claimed, followerCount }, videos }, 120);
  } catch (err) {
    return errorResponse('This creator profile is temporarily unavailable.', 503);
  }
}
