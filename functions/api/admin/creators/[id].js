import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { getChannelById, updateChannelFields } from '../../../../shared/db.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const channel = await getChannelById(env.DB, params.id);
  if (!channel) return errorResponse('Channel not found.', 404);
  return json({ channel });
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const channel = await getChannelById(env.DB, params.id);
  if (!channel) return errorResponse('Channel not found.', 404);

  const body = await readJsonBody(request);
  if (!body) return errorResponse('Invalid request body.', 400);

  await updateChannelFields(env.DB, params.id, body);
  return json({ ok: true });
}
