import { errorResponse } from '../../../shared/http.js';
import { parseCookies } from '../../../shared/auth.js';
import { getSessionUser } from '../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../shared/constants.js';

// Gates every /api/comments/* route — self-delete only, so unlike the
// GET+POST split on native-comments/index.js, every route here needs auth.
export async function onRequest(context) {
  const { request, env, next, data } = context;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const user = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);

  if (!user) return errorResponse('Sign in to manage comments.', 401);

  data.user = user;
  return next();
}
