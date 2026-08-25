import { cacheableJson, errorResponse } from '../../../../shared/http.js';
import { getCachedComments, setCachedComments } from '../../../../shared/db.js';
import { listCommentThreads } from '../../../../shared/youtube.js';

// :id is the YouTube video id. Comments are real YouTube data (read-only —
// viewers reply on YouTube itself, not here), fetched on demand and cached
// for 6 hours per video so an actively-viewed Short doesn't re-hit the
// YouTube API on every comments-drawer open. commentThreads.list is cheap
// (1 unit), so this is affordable even fetched somewhat often.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function onRequestGet(context) {
  const { env, params } = context;
  const videoId = params.id;

  try {
    const cached = await getCachedComments(env.DB, videoId);
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
      return cacheableJson({ comments: cached.status === 'disabled' ? [] : JSON.parse(cached.comments_json || '[]'), disabled: cached.status === 'disabled' });
    }

    if (!env.YOUTUBE_API_KEY) {
      // No key configured on this deployment — fall back to a stale cache
      // entry if one exists, otherwise an empty (not error) state.
      return cacheableJson({ comments: cached && cached.status === 'ok' ? JSON.parse(cached.comments_json || '[]') : [], disabled: cached?.status === 'disabled' });
    }

    const { data: comments } = await listCommentThreads(env.YOUTUBE_API_KEY, videoId);
    await setCachedComments(env.DB, videoId, JSON.stringify(comments), 'ok');
    return cacheableJson({ comments, disabled: false }, 300);
  } catch (err) {
    if (err.youtubeReason === 'commentsDisabled') {
      await setCachedComments(env.DB, videoId, null, 'disabled').catch(() => {});
      return cacheableJson({ comments: [], disabled: true }, 300);
    }
    // Any other failure (quota, network, video not found) — degrade to an
    // empty drawer rather than a broken one; never block Shorts playback.
    return errorResponse('Comments are temporarily unavailable.', 503);
  }
}
