import { json, errorResponse } from '../../../shared/http.js';
import { parseCookies } from '../../../shared/auth.js';
import { getSessionUser } from '../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../shared/constants.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const user = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);

  if (!user) return errorResponse('Not signed in.', 401);

  return json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
}
