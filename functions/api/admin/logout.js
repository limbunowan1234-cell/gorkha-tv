import { buildClearCookie } from '../../../shared/auth.js';
import { json } from '../../../shared/http.js';
import { ADMIN_SESSION_COOKIE } from '../../../shared/constants.js';

export async function onRequestPost() {
  return json({ ok: true }, { headers: { 'Set-Cookie': buildClearCookie(ADMIN_SESSION_COOKIE) } });
}
