import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { addFavourite, listFavourites, bumpVideoAffinity } from '../../../shared/db.js';
import { VIDEO_AFFINITY_WEIGHTS } from '../../../shared/constants.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const favourites = await listFavourites(env.DB, data.user.id);
  return json({ favourites });
}

// videoId here is our internal videos.id (the value every /api/videos*
// response exposes as `id`), not the YouTube video ID — favourites.video_id
// is a foreign key into videos.id per the schema. category/channelId are
// optional — the caller already has the video's metadata loaded (same
// pattern gorkhatv2/js/shorts.js's postShortsEvent uses), so this route
// doesn't need an extra lookup to feed the "Because You Liked" affinity
// signal (functions/api/home/personalized.js). This route already requires
// sign-in (see _middleware.js), so data.user.id is used directly rather
// than resolveSessionKey's anon-cookie fallback.
export async function onRequestPost(context) {
  const { request, env, data } = context;
  const body = await readJsonBody(request);
  const videoId = body?.videoId;
  if (!videoId) return errorResponse('videoId is required.', 400);

  await addFavourite(env.DB, data.user.id, videoId);

  const delta = VIDEO_AFFINITY_WEIGHTS.liked;
  await Promise.all([
    body.category ? bumpVideoAffinity(env.DB, data.user.id, 'category', body.category, delta) : null,
    body.channelId ? bumpVideoAffinity(env.DB, data.user.id, 'channel', body.channelId, delta) : null,
  ]);

  return json({ ok: true });
}
