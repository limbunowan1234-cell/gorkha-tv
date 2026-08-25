import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { resolveSessionKey, upsertWatchProgress, getWatchProgress, bumpVideoAffinity, checkRateLimit } from '../../../../shared/db.js';
import { VIDEO_AFFINITY_WEIGHTS, WATCH_AFFINITY_THRESHOLD } from '../../../../shared/constants.js';

// :id is the YouTube video id. Drives the homepage "Continue Watching" row
// and lets the watch page resume playback — see gorkhatv2/js/watch.js.
const MAX_PROGRESS_PER_WINDOW = 150; // comfortably covers 45+ minutes of continuous watching at the client's ~20s sync interval

export async function onRequestGet(context) {
  const { request, env, params } = context;
  try {
    const { sessionKey, setCookieHeader } = await resolveSessionKey(env.DB, request);
    const progress = await getWatchProgress(env.DB, sessionKey, params.id);
    // Per-viewer — must never be served from a shared/edge cache.
    return json({ progress: progress || null }, { headers: { 'Cache-Control': 'private, no-store', ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}) } });
  } catch (err) {
    return json({ progress: null });
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const { allowed } = await checkRateLimit(env.DB, `watch-progress:${ip}`, MAX_PROGRESS_PER_WINDOW);
  if (!allowed) return errorResponse('Too many requests.', 429);

  const body = await readJsonBody(request);
  const progressSeconds = Number(body?.progressSeconds);
  const durationSeconds = body?.durationSeconds ? Number(body.durationSeconds) : null;
  if (!Number.isFinite(progressSeconds) || progressSeconds < 0) return errorResponse('progressSeconds is required.', 400);

  try {
    const { sessionKey, setCookieHeader } = await resolveSessionKey(env.DB, request);

    // Bump video_affinity only the first time this viewer's progress on this
    // video crosses the threshold — not on every ~20s ping, which would
    // otherwise inflate the score for one long watch far beyond what a
    // genuinely-repeated signal (e.g. Saves) is worth.
    let shouldBump = false;
    if (durationSeconds && (body?.category || body?.channelId)) {
      const existing = await getWatchProgress(env.DB, sessionKey, params.id);
      const wasBelow = !existing || existing.progress_seconds < durationSeconds * WATCH_AFFINITY_THRESHOLD;
      const nowAbove = progressSeconds >= durationSeconds * WATCH_AFFINITY_THRESHOLD;
      shouldBump = wasBelow && nowAbove;
    }

    await upsertWatchProgress(env.DB, sessionKey, params.id, progressSeconds, durationSeconds);

    if (shouldBump) {
      const delta = VIDEO_AFFINITY_WEIGHTS.watched_30pct;
      await Promise.all([
        body.category ? bumpVideoAffinity(env.DB, sessionKey, 'category', body.category, delta) : null,
        body.channelId ? bumpVideoAffinity(env.DB, sessionKey, 'channel', body.channelId, delta) : null,
      ]);
    }

    return json({ ok: true }, setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : {});
  } catch (err) {
    // Progress tracking is best-effort — never surface this as a user-facing error.
    return json({ ok: false });
  }
}
