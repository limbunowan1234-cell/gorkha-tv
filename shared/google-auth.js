// Verifies a Google Identity Services id_token (JWT) via Google's tokeninfo
// endpoint — this validates the signature/expiry server-side without us
// needing a JWKS/crypto.subtle.verify implementation, at the cost of one
// extra network hop per sign-in (acceptable: sign-in is infrequent, not a
// hot path). No client secret is required for this flow.
export async function verifyGoogleIdToken(idToken, expectedAudience) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error('Invalid or expired Google sign-in token.');

  const payload = await res.json();

  // Critical check: without this, a valid Google id_token issued for a
  // DIFFERENT app could be replayed here to impersonate any Google account.
  if (payload.aud !== expectedAudience) throw new Error('This sign-in token was not issued for GorkhaTV.');
  if (!payload.sub) throw new Error('Malformed Google sign-in token.');

  return payload; // { sub, email, email_verified, name, picture, aud, exp, ... }
}
