// Edge cache for public, non-personalized responses.
//
// Routes already mark what's shareable — cacheableJson() and the SSR pages
// send `Cache-Control: public, ..., s-maxage=N` — but Cloudflare Pages does
// not edge-cache Function responses on its own (they come back
// cf-cache-status: DYNAMIC), so every request was re-running its D1
// queries: /api/home took ~1-1.3s on every homepage visit. This stores those
// responses in the colo's Cache API and serves repeats from it.
//
// Only GET responses that are 200, `public`, carry an s-maxage, and don't
// set a cookie are cached — personalized/auth routes (e.g.
// /api/home/personalized, which is `private, no-store` and sets a session
// cookie) never qualify. The cache key is the URL alone, never cookies or
// headers, which is exactly why only those routes are eligible.
//
// TTL is the route's own s-maxage, capped at MAX_EDGE_TTL so an admin
// change (approving a video, reordering the hero) shows up within minutes.
const MAX_EDGE_TTL = 300;

export async function onRequest(context) {
  const { request, next, waitUntil } = context;
  if (request.method !== 'GET') return next();

  const cache = caches.default;
  const key = new Request(request.url, { method: 'GET' });

  const hit = await cache.match(key);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set('x-gtv-edge-cache', 'HIT');
    return res;
  }

  const res = await next();
  const cc = res.headers.get('cache-control') || '';
  const sMaxAge = Number(cc.match(/s-maxage=(\d+)/)?.[1] || 0);
  if (res.status !== 200 || !/\bpublic\b/.test(cc) || !sMaxAge || res.headers.has('set-cookie')) return res;

  const ttl = Math.min(sMaxAge, MAX_EDGE_TTL);
  const stored = new Response(res.clone().body, res);
  stored.headers.set('cache-control', `public, max-age=${ttl}`);
  waitUntil(cache.put(key, stored));

  const out = new Response(res.body, res);
  out.headers.set('x-gtv-edge-cache', 'MISS');
  return out;
}
