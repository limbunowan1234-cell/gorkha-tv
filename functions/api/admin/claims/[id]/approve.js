import { json, errorResponse } from '../../../../../shared/http.js';
import { approveChannelClaim } from '../../../../../shared/db.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const ok = await approveChannelClaim(env.DB, params.id);
  if (!ok) return errorResponse('Claim not found or already reviewed.', 404);
  return json({ ok: true });
}
