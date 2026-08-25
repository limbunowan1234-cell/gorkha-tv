import { json } from '../../../shared/http.js';
import { resolveSessionKey, recordSessionActivity, checkRateLimit } from '../../../shared/db.js';

// Fired once per page load from gorkhatv2/js/auth.js's initAuthNav() — the
// one choke point that already runs on every public page. Powers the admin
// analytics dashboard's DAU/MAU/new-vs-returning numbers. Best-effort: never
// surfaces an error to the viewer, same spirit as videos/[id]/progress.js.
const MAX_PINGS_PER_WINDOW = 60; // one ping per page load — generous for a normal browsing session

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const { allowed } = await checkRateLimit(env.DB, `track-ping:${ip}`, MAX_PINGS_PER_WINDOW);
  if (!allowed) return json({ ok: false });

  try {
    const { sessionKey, setCookieHeader } = await resolveSessionKey(env.DB, request);
    await recordSessionActivity(env.DB, sessionKey);
    return json({ ok: true }, setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : {});
  } catch {
    return json({ ok: false });
  }
}
