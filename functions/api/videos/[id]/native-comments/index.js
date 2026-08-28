import { json, errorResponse, readJsonBody } from '../../../../../shared/http.js';
import { parseCookies } from '../../../../../shared/auth.js';
import { getSessionUser, getCommentById, insertVideoComment, listTopLevelComments, countTopLevelComments, checkRateLimit } from '../../../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../../../shared/constants.js';

// :id is the YouTube video id, same convention as sibling progress.js/view.js/
// related.js. GET is public (comments are public content on a public video
// page); POST needs auth — that split is why this isn't gated by a folder
// _middleware.js the way functions/api/comments/* is.
const MAX_BODY_LENGTH = 1000;
const MAX_COMMENTS_PER_WINDOW = 15;

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  try {
    const [comments, total] = await Promise.all([
      listTopLevelComments(env.DB, params.id, { page, limit }),
      countTopLevelComments(env.DB, params.id),
    ]);
    return json({ comments, total, page, limit });
  } catch (err) {
    return errorResponse('Comments are temporarily unavailable.', 503);
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context;

  const cookies = parseCookies(request.headers.get('Cookie'));
  const user = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);
  if (!user) return errorResponse('Sign in to comment.', 401);

  const { allowed } = await checkRateLimit(env.DB, `comment-post:${user.id}`, MAX_COMMENTS_PER_WINDOW);
  if (!allowed) return errorResponse('Too many comments — please slow down.', 429);

  const video = await env.DB.prepare(`SELECT id FROM videos WHERE youtube_video_id = ? AND status = 'published'`).bind(params.id).first();
  if (!video) return errorResponse('Video not found.', 404);

  const body = await readJsonBody(request);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) return errorResponse('Comment cannot be empty.', 400);
  if (text.length > MAX_BODY_LENGTH) return errorResponse(`Comments are limited to ${MAX_BODY_LENGTH} characters.`, 400);

  let parentCommentId = null;
  if (body?.parentCommentId) {
    const parent = await getCommentById(env.DB, body.parentCommentId);
    if (!parent || parent.youtube_video_id !== params.id || parent.parent_comment_id) {
      return errorResponse('Invalid comment to reply to.', 400);
    }
    parentCommentId = parent.id;
  }

  // Server-computed, never trusts client-supplied name/avatar — same
  // display_name-over-name fallback as functions/api/auth/me.js.
  const authorName = user.display_name || user.name;
  const authorAvatarUrl = user.avatar_url;

  const { id, createdAt } = await insertVideoComment(env.DB, {
    youtubeVideoId: params.id,
    userId: user.id,
    parentCommentId,
    body: text,
    authorName,
    authorAvatarUrl,
  });

  return json(
    {
      comment: {
        id,
        youtube_video_id: params.id,
        user_id: user.id,
        parent_comment_id: parentCommentId,
        body: text,
        author_name: authorName,
        author_avatar_url: authorAvatarUrl,
        created_at: createdAt,
        reply_count: 0,
      },
    },
    { status: 201 }
  );
}
