// Tiny JSON response helpers shared by every Pages Functions route.

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

// For public, non-personalized GET routes only (home/videos/categories/etc.)
// — never use on admin/auth/favourites responses. Short TTL because content
// changes via admin approvals as well as the 6-hourly sync, not just sync;
// s-maxage lets Cloudflare's edge absorb repeat traffic between those changes
// without user-facing staleness stretching past a few minutes.
export function cacheableJson(data, seconds = 60) {
  return json(data, { headers: { 'Cache-Control': `public, max-age=${seconds}, s-maxage=${seconds * 5}` } });
}

export function errorResponse(message, status = 400) {
  return json({ error: message }, { status });
}

// Strips the default title/description/canonical/OG/Twitter tags a static
// HTML template ships with, so an SSR route (functions/category/[cat].js,
// functions/location/[loc].js) can inject its own per-page versions without
// ending up with duplicate/conflicting tags (e.g. two <link rel="canonical">
// elements, which confuses crawlers about which URL is authoritative).
export function stripDefaultSeoTags(html) {
  return html
    .replace(/<title>.*?<\/title>/i, '')
    .replace(/<meta name="description"[^>]*>/i, '')
    .replace(/<link rel="canonical"[^>]*>/i, '')
    .replace(/<meta property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta name="twitter:[^"]*"[^>]*>/gi, '');
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
