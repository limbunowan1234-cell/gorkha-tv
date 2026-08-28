import { json, errorResponse } from '../../../../../../shared/http.js';
import { listCommentReplies } from '../../../../../../shared/db.js';

// Public, on-demand — replies aren't embedded in the top-level list response
// to keep that payload light; the client fetches this only when a viewer
// expands "View N replies" (see gorkhatv2/js/comments.js).
export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const replies = await listCommentReplies(env.DB, params.commentId);
    return json({ replies });
  } catch (err) {
    return errorResponse('Replies are temporarily unavailable.', 503);
  }
}
