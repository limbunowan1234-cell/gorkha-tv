import { json, errorResponse } from '../../../../../shared/http.js';
import { updateVideoStatus } from '../../../../../shared/db.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const video = await env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(params.id).first();
  if (!video) return errorResponse('Video not found.', 404);

  await updateVideoStatus(env.DB, params.id, 'published');
  return json({ ok: true });
}
