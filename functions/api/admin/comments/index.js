import { json } from '../../../../shared/http.js';
import { listAllCommentsAdmin, countAllComments } from '../../../../shared/db.js';

// Gated by the existing functions/api/admin/_middleware.js — no changes needed there.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 30));

  const [comments, total] = await Promise.all([listAllCommentsAdmin(env.DB, { page, limit }), countAllComments(env.DB)]);
  return json({ comments, total, page, limit });
}
