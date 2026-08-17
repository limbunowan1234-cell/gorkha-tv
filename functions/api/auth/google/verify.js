import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { verifyGoogleIdToken } from '../../../../shared/google-auth.js';
import { upsertUserByGoogleSub, createSession, checkRateLimit } from '../../../../shared/db.js';
import { buildSetCookie } from '../../../../shared/auth.js';
import { VIEWER_SESSION_COOKIE, VIEWER_SESSION_TTL_SECONDS } from '../../../../shared/constants.js';

const MAX_VERIFY_ATTEMPTS_PER_WINDOW = 20;

// Called by js/auth.js with the id_token Google Identity Services hands back
// client-side after the user picks an account — no redirect flow, no client
// secret needed.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    return errorResponse('Google sign-in is not configured on this deployment.', 500);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { allowed } = await checkRateLimit(env.DB, `google-verify:${ip}`, MAX_VERIFY_ATTEMPTS_PER_WINDOW);
  if (!allowed) {
    return errorResponse('Too many sign-in attempts. Please try again shortly.', 429);
  }

  const body = await readJsonBody(request);
  const credential = body?.credential;
  if (!credential || typeof credential !== 'string') {
    return errorResponse('Missing sign-in credential.', 400);
  }

  try {
    const payload = await verifyGoogleIdToken(credential, env.GOOGLE_OAUTH_CLIENT_ID);
    const userId = await upsertUserByGoogleSub(env.DB, {
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
    });
    const { sessionId, expiresAt } = await createSession(env.DB, userId, VIEWER_SESSION_TTL_SECONDS);

    return json(
      { ok: true, expiresAt },
      { headers: { 'Set-Cookie': buildSetCookie(VIEWER_SESSION_COOKIE, sessionId, { maxAgeSeconds: VIEWER_SESSION_TTL_SECONDS }) } }
    );
  } catch (err) {
    return errorResponse(err.message || 'Sign-in failed.', 401);
  }
}
