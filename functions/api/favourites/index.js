import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { addFavourite, listFavourites } from '../../../shared/db.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const favourites = await listFavourites(env.DB, data.user.id);
  return json({ favourites });
}

// videoId here is our internal videos.id (the value every /api/videos*
// response exposes as `id`), not the YouTube video ID — favourites.video_id
// is a foreign key into videos.id per the schema.
export async function onRequestPost(context) {
  const { request, env, data } = context;
  const body = await readJsonBody(request);
  const videoId = body?.videoId;
  if (!videoId) return errorResponse('videoId is required.', 400);

  await addFavourite(env.DB, data.user.id, videoId);
  return json({ ok: true });
}
