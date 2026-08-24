import { json } from '../../../../../shared/http.js';
import { rejectChannelClaim } from '../../../../../shared/db.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  await rejectChannelClaim(env.DB, params.id);
  return json({ ok: true });
}
