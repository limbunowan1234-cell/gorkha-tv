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
  // Always no-store: an error response (401/403/404/429/503...) must never
  // be served from a shared/browser cache to a different user later — don't
  // rely solely on the _headers file for this, since its merge behavior onto
  // Function-generated error responses varies by environment.
  return json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
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

// BreadcrumbList structured data — Google renders this as a breadcrumb
// trail in search results instead of the raw URL path, which reliably
// improves click-through on deep pages (watch/genre/category/location/
// creator) that are usually the actual entry point from search, not the
// homepage. `items` is [{name, url}], root-first (Home always first).
// Escaping (same as videoJsonLd below and the pages' own safeJsonLd): JSON.stringify
// can legally emit a literal "</script>" inside a string value (e.g. a
// video title containing that text), which would terminate the embedding
// <script> tag early — <-escaping "<" prevents that.
export function breadcrumbJsonLd(items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }).replace(/</g, '\\u003c');
}

// Sitewide visible breadcrumb trail — plain HTML, server-injected alongside
// the SEO meta tags on the same SSR routes that also emit breadcrumbJsonLd
// above, so it's present without waiting on client JS and always matches
// the structured data exactly. `items` is [{name, url}] root-first; the
// last item renders as plain text (current page, not a link), matching
// standard breadcrumb UX.
export function breadcrumbHTML(items) {
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const label = escapeHtmlForBreadcrumb(item.name);
    return isLast ? `<span aria-current="page">${label}</span>` : `<a href="${escapeHtmlForBreadcrumb(item.url)}">${label}</a>`;
  });
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${parts.join('<span class="breadcrumb-sep">›</span>')}</nav>`;
}

function escapeHtmlForBreadcrumb(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Meta-description text from a free-form (usually YouTube) description:
// whitespace/newlines collapsed, cut at a word boundary to <=160 chars so
// Google doesn't truncate mid-word. Falls back when the source is empty.
export function metaDescription(text, fallback) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  if (clean.length <= 160) return clean;
  const cut = clean.slice(0, 159);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?—-]+$/, '')}…`;
}

// schema.org VideoObject for a row from the videos table — shared by
// functions/watch/[id].js and shared/render-shorts-page.js so watch pages and
// Shorts emit the same shape. Escaped the same way as breadcrumbJsonLd.
export function videoJsonLd(video, { pageUrl, description, thumbnail }) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description,
    thumbnailUrl: [thumbnail],
    uploadDate: video.published_at,
    url: pageUrl,
    ...(video.duration_seconds ? { duration: `PT${video.duration_seconds}S` } : {}),
    embedUrl: `https://www.youtube.com/embed/${video.youtube_video_id}`,
    // Devanagari in the title is a reliable "this is Nepali" signal;
    // Roman-script titles can be either language, so they're left unset.
    ...(/[\u0900-\u097F]/.test(video.title || '') ? { inLanguage: 'ne' } : {}),
    ...(video.view_count
      ? { interactionStatistic: { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: video.view_count } }
      : {}),
    ...(video.channel_name ? { author: { '@type': 'Person', name: video.channel_name } } : {}),
    publisher: { '@type': 'Organization', name: 'GorkhaTV', url: new URL(pageUrl).origin, logo: { '@type': 'ImageObject', url: `${new URL(pageUrl).origin}/logo-circle.png` } },
  }).replace(/</g, '\\u003c');
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
