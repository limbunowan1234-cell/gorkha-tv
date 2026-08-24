import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { updateOwnedChannelFields } from '../../../../shared/db.js';

// Deliberately restricted to description/location/category — see
// shared/db.js's updateOwnedChannelFields for why status/featured/verified/
// monitoring_enabled are excluded (a creator editing their own listing must
// never be able to self-approve or self-feature it).
export async function onRequestPatch(context) {
  const { request, env, params, data } = context;
  const body = await readJsonBody(request);
  if (!body) return errorResponse('Invalid request body.', 400);

  const fields = {};
  if (typeof body.description === 'string') fields.description = body.description.trim().slice(0, 2000);
  if (typeof body.location === 'string') fields.location = body.location || null;
  if (typeof body.category === 'string') fields.category = body.category || null;

  const ok = await updateOwnedChannelFields(env.DB, params.id, data.user.id, fields);
  if (!ok) return errorResponse('Channel not found or not owned by you.', 404);

  return json({ ok: true });
}
