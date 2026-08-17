import { json } from '../../../shared/http.js';
import { removeFavourite } from '../../../shared/db.js';

export async function onRequestDelete(context) {
  const { env, params, data } = context;
  await removeFavourite(env.DB, data.user.id, params.videoId);
  return json({ ok: true });
}
