import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { parseCookies } from '../../../shared/auth.js';
import { getSessionUser, updateUserProfile } from '../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../shared/constants.js';

const MAX_DISPLAY_NAME_LENGTH = 60;
const MAX_BIO_LENGTH = 280;

export async function onRequestPatch(context) {
  const { request, env } = context;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const user = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);
  if (!user) return errorResponse('Sign in to edit your profile.', 401);

  const body = await readJsonBody(request);
  if (!body) return errorResponse('Invalid request body.', 400);

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) : null;
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, MAX_BIO_LENGTH) : null;

  await updateUserProfile(env.DB, user.id, { displayName: displayName || null, bio: bio || null });
  return json({ ok: true });
}
