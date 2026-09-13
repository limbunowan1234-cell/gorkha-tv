// Serves gorkhatv2/templates/home.html for GET / — the site's own homepage.
// Previously a fully static file: the hero background is the page's
// largest image, but nothing started fetching it until js/home.js had
// loaded, called fetch('/api/home'), gotten a response back, and set
// background-image via JS — several sequential round-trips before the
// browser even knew the image's URL. This adds one small server-side
// query (same hero-selection logic as functions/api/home.js, LIMIT 1
// instead of 5) purely to inject a <link rel=preload> hint for that
// image, discovered by the browser's preload scanner during initial HTML
// parse — js/home.js still does all the actual rendering, unchanged.
//
// functions/[slug].js's own catch-all already falls through to
// env.ASSETS.fetch() for an empty slug (i.e. "/"), but this route (an
// exact match, not a dynamic one) takes precedence for "/" specifically —
// same precedence Cloudflare already gives functions/shorts.js over that
// catch-all, per its own comment.

const VIDEO_COLUMNS = 'youtube_video_id, thumbnail_url';
const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";

export async function onRequestGet(context) {
  const { env } = context;

  const assetUrl = new URL('/templates/home.html', new URL(context.request.url).origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  try {
    // Mirrors functions/api/home.js's hero query + its "fall back to
    // latest" rule exactly, just LIMIT 1 — this only ever needs to know
    // what the FIRST hero item will be (heroItems[0], shown before any
    // rotation), not the full carousel.
    let hero = await env.DB.prepare(
      `SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND featured = 1
       ORDER BY (hero_order IS NULL) ASC, hero_order ASC, published_at DESC LIMIT 1`
    ).first();

    if (!hero) {
      hero = await env.DB.prepare(
        `SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND (category IS NULL OR category != 'news')
         ORDER BY published_at DESC LIMIT 1`
      ).first();
    }

    if (hero?.youtube_video_id) {
      // Matches js/home.js's setHeroBackground(): maxresdefault.jpg is what
      // actually gets displayed for the (large majority of) videos that
      // have one — preloading it is the correct bet, not thumbnail_url's
      // lower-res 480x360. If a given video lacks a maxres variant,
      // js/home.js's own onload/naturalWidth check already falls back to
      // thumbnail_url — this preload just goes unused that one time, not
      // an error.
      const preload = `<link rel="preload" as="image" fetchpriority="high" href="https://img.youtube.com/vi/${hero.youtube_video_id}/maxresdefault.jpg">`;
      html = html.replace('<!-- HERO-PRELOAD-PLACEHOLDER -->', preload);
    }
  } catch (err) {
    // D1 hiccup: serve the page without the preload hint rather than fail
    // the whole homepage — js/home.js's own fetch('/api/home') still
    // renders everything, just without this one head-start.
  }

  return new Response(html, {
    headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}
