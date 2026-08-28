import { json } from '../../../../shared/http.js';
import { deleteCommentCascade } from '../../../../shared/db.js';

// Admin delete — no ownership check, unlike functions/api/comments/[commentId].js.
export async function onRequestDelete(context) {
  const { env, params } = context;
  await deleteCommentCascade(env.DB, params.id);
  return json({ ok: true });
}
