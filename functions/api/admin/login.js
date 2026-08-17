import { verifyPassword, signSession, buildSetCookie } from '../../../shared/auth.js';
import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { checkRateLimit } from '../../../shared/db.js';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from '../../../shared/constants.js';

const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 10;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_SESSION_SECRET) {
    return errorResponse('Admin login is not configured on this deployment.', 500);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { allowed } = await checkRateLimit(env.DB, `admin-login:${ip}`, MAX_LOGIN_ATTEMPTS_PER_WINDOW);
  if (!allowed) {
    return errorResponse('Too many login attempts. Please try again in a few minutes.', 429);
  }

  const body = await readJsonBody(request);
  const password = body?.password;
  if (!password || typeof password !== 'string') {
    return errorResponse('Password is required.', 400);
  }

  const valid = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return errorResponse('Incorrect password.', 401);
  }

  const token = await signSession(env.ADMIN_SESSION_SECRET, { role: 'admin' }, ADMIN_SESSION_TTL_SECONDS);
  return json(
    { ok: true },
    { headers: { 'Set-Cookie': buildSetCookie(ADMIN_SESSION_COOKIE, token, { maxAgeSeconds: ADMIN_SESSION_TTL_SECONDS }) } }
  );
}
