import { json } from '../../../../shared/http.js';
import { getChannelsByOwner } from '../../../../shared/db.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const channels = await getChannelsByOwner(env.DB, data.user.id);
  return json({ channels });
}
