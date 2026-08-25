import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { resolveSessionKey, bumpShortsAffinity } from '../../../shared/db.js';
import { SHORTS_AFFINITY_WEIGHTS } from '../../../shared/constants.js';

// Fire-and-forget watch-behavior signal from the Shorts feed (see
// gorkhatv2/js/shorts.js) — no auth required, works for anonymous viewers via
// resolveSessionKey's anon-cookie fallback. Never blocks or fails
// playback: any error here is swallowed by the caller (sendBeacon has no
// response handling anyway).
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJsonBody(request);
  const { category, channelId, eventType } = body || {};

  if (!(eventType in SHORTS_AFFINITY_WEIGHTS)) {
    return errorResponse(`eventType must be one of: ${Object.keys(SHORTS_AFFINITY_WEIGHTS).join(', ')}`, 400);
  }
  if (!category && !channelId) return errorResponse('category or channelId is required.', 400);

  try {
    const { sessionKey, setCookieHeader } = await resolveSessionKey(env.DB, request);
    const delta = SHORTS_AFFINITY_WEIGHTS[eventType];

    await Promise.all([
      category ? bumpShortsAffinity(env.DB, sessionKey, 'category', category, delta) : null,
      channelId ? bumpShortsAffinity(env.DB, sessionKey, 'channel', channelId, delta) : null,
    ]);

    return json({ ok: true }, setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : {});
  } catch (err) {
    // Personalization signal is best-effort — never surface this as a user-facing error.
    return json({ ok: false });
  }
}
