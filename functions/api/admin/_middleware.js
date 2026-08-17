// Gates every /api/admin/* route behind a signed admin session cookie, except
// the login endpoint itself (which is how the cookie gets issued) and logout
// (safe to call regardless of session validity).

import { verifySession, parseCookies } from '../../../shared/auth.js';
import { errorResponse } from '../../../shared/http.js';
import { ADMIN_SESSION_COOKIE } from '../../../shared/constants.js';

const PUBLIC_PATHS = new Set(['/api/admin/login', '/api/admin/logout']);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.has(url.pathname)) {
    return next();
  }

  if (!env.ADMIN_SESSION_SECRET) {
    return errorResponse('Admin auth is not configured on this deployment.', 500);
  }

  const cookies = parseCookies(request.headers.get('Cookie'));
  const session = await verifySession(env.ADMIN_SESSION_SECRET, cookies[ADMIN_SESSION_COOKIE]);
  if (!session || session.role !== 'admin') {
    return errorResponse('Unauthorized — please log in.', 401);
  }

  return next();
}
