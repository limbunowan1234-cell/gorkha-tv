import { json, errorResponse } from '../../../shared/http.js';
import { getCommentById, deleteCommentCascade } from '../../../shared/db.js';

// Self-delete only — deleting someone else's comment is functions/api/admin/comments/[id].js.
export async function onRequestDelete(context) {
  const { env, params, data } = context;
  const comment = await getCommentById(env.DB, params.commentId);
  if (!comment) return errorResponse('Comment not found.', 404);
  if (comment.user_id !== data.user.id) return errorResponse('You can only delete your own comments.', 403);

  await deleteCommentCascade(env.DB, params.commentId);
  return json({ ok: true });
}
