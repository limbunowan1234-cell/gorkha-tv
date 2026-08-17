import { json } from '../../../shared/http.js';

// The Google OAuth Client ID is a public identifier (not a secret) — safe to
// hand to the browser so it can initialize Google Identity Services. If it's
// not configured, the frontend simply omits the sign-in button.
export async function onRequestGet(context) {
  return json({ googleClientId: context.env.GOOGLE_OAUTH_CLIENT_ID || null });
}
