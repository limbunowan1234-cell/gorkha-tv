import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { updateVideoStatus } from '../../../../shared/db.js';
import { VIDEO_STATUSES } from '../../../../shared/constants.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const video = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(params.id).first();
  if (!video) return errorResponse('Video not found.', 404);
  return json({ video });
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const video = await env.DB.prepare('SELECT id, status FROM videos WHERE id = ?').bind(params.id).first();
  if (!video) return errorResponse('Video not found.', 404);

  const body = await readJsonBody(request);
  if (!body) return errorResponse('Invalid request body.', 400);

  if (body.status !== undefined && !VIDEO_STATUSES.includes(body.status)) {
    return errorResponse(`status must be one of: ${VIDEO_STATUSES.join(', ')}`, 400);
  }

  const extra = {};
  if (body.featured !== undefined) extra.featured = !!body.featured;
  if (body.trending !== undefined) extra.trending = !!body.trending;
  if (body.category !== undefined) extra.category = body.category;
  if (body.location !== undefined) extra.location = body.location;
  if (body.contentType !== undefined) {
    if (body.contentType !== null && !['short', 'video'].includes(body.contentType)) {
      return errorResponse("contentType must be 'short', 'video', or null.", 400);
    }
    extra.contentType = body.contentType;
  }

  await updateVideoStatus(env.DB, params.id, body.status || video.status, extra);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const video = await env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(params.id).first();
  if (!video) return errorResponse('Video not found.', 404);

  await updateVideoStatus(env.DB, params.id, 'removed');
  return json({ ok: true });
}
