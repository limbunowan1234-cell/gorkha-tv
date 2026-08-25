import { json } from '../../../shared/http.js';
import { removeFollow } from '../../../shared/db.js';

export async function onRequestDelete(context) {
  const { env, params, data } = context;
  await removeFollow(env.DB, data.user.id, params.channelId);
  return json({ ok: true });
}
