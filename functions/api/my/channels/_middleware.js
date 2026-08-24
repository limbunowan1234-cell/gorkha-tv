import { errorResponse } from '../../../../shared/http.js';
import { parseCookies } from '../../../../shared/auth.js';
import { getSessionUser } from '../../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../../shared/constants.js';

// Same pattern as functions/api/favourites/_middleware.js — gates every
// /api/my/channels/* route behind a valid viewer session and hands the
// resolved user to the route handler via context.data.
export async function onRequest(context) {
  const { request, env, next, data } = context;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const user = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);

  if (!user) return errorResponse('Sign in to manage your channels.', 401);

  data.user = user;
  return next();
}
