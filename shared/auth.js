// HMAC cookie signing/verification (Web Crypto — works identically in
// Cloudflare Workers/Pages Functions and Node 20+) and password hashing for
// the admin login. Shared by the admin session middleware and the viewer
// (Google-authenticated) session checks — they use separate secrets so a leak
// of one does not compromise the other.

const encoder = new TextEncoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toBase64Url(bytes) {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Signs `{ ...payload, exp }` into "base64url(json).base64url(signature)".
export async function signSession(secret, payload, ttlSeconds) {
  const body = JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 });
  const bodyB64 = toBase64Url(encoder.encode(body));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyB64));
  return `${bodyB64}.${toBase64Url(signature)}`;
}

// Returns the parsed payload if the signature is valid and not expired, else null.
export async function verifySession(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [bodyB64, sigB64] = token.split('.');
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(sigB64), encoder.encode(bodyB64));
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(bodyB64)));
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function buildSetCookie(name, value, { maxAgeSeconds, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}

export function buildClearCookie(name, path = '/') {
  return `${name}=; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Opaque random token for stateful (DB-looked-up) sessions — used for viewer
// sessions, which are revocable server-side (unlike the admin's stateless
// signed cookie, see signSession above).
export function randomToken(bytes = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

// ── Admin password hashing (PBKDF2-SHA256) ──
// Stored format: "iterations:saltHex:hashHex". Generate ADMIN_PASSWORD_HASH
// with `node scripts/hash-password.mjs <password>`.

const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return bits;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [iterationsStr, saltHex, hashHex] = String(stored || '').split(':');
  const iterations = Number(iterationsStr);
  if (!iterations || !saltHex || !hashHex) return false;
  const computed = toHex(await pbkdf2(password, fromHex(saltHex), iterations));
  return timingSafeEqual(computed, hashHex);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
