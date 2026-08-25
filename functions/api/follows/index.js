import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { addFollow, listFollowedChannels } from '../../../shared/db.js';

// Doubles as the "am I following this channel" check — the caller fetches
// the whole list and checks with .some(), same pattern watch.js's
// initFavouriteButton already uses for favourites. Fine at this site's scale.
export async function onRequestGet(context) {
  const { env, data } = context;
  const follows = await listFollowedChannels(env.DB, data.user.id);
  return json({ follows });
}

// channelId here is our internal channels.id, not the YouTube channel id.
export async function onRequestPost(context) {
  const { request, env, data } = context;
  const body = await readJsonBody(request);
  const channelId = body?.channelId;
  if (!channelId) return errorResponse('channelId is required.', 400);

  await addFollow(env.DB, data.user.id, channelId);
  return json({ ok: true });
}
