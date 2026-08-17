import { json } from '../../../shared/http.js';
import { buildClearCookie, parseCookies } from '../../../shared/auth.js';
import { deleteSession } from '../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../shared/constants.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies[VIEWER_SESSION_COOKIE];

  if (sessionId) {
    await deleteSession(env.DB, sessionId).catch(() => {});
  }

  return json({ ok: true }, { headers: { 'Set-Cookie': buildClearCookie(VIEWER_SESSION_COOKIE) } });
}
