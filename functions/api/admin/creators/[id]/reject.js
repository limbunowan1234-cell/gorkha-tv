import { json, errorResponse } from '../../../../../shared/http.js';
import { getChannelById, updateChannelStatus } from '../../../../../shared/db.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const channel = await getChannelById(env.DB, params.id);
  if (!channel) return errorResponse('Channel not found.', 404);

  await updateChannelStatus(env.DB, params.id, 'rejected', { monitoringEnabled: false });
  return json({ ok: true });
}
