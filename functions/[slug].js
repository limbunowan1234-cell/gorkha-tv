// Root-level channel profile URLs (gorkhatv.site/:slug) — serves
// templates/creator.html and injects SEO/OG meta, same pattern as the old
// functions/creator/[id].js (which now just redirects here).
//
// This being a catch-all top-level Function route means Cloudflare invokes
// it for ANY single-segment path that no more specific route claims —
// confirmed experimentally: a genuinely static top-level file like
// /manifest.json or /robots.txt has no explicit Function of its own, so
// without the fallback below this route would swallow it and return a bare
// 404 instead of the real file (an explicitly-named Function route, like
// functions/shorts.js for bare /shorts, DOES correctly take precedence over
// this catch-all — only routes with nothing more specific reach here).
// RESERVED_ROOT_SLUGS still matters for slug *generation* (a channel must
// never be assigned one of these), but for routing itself the safe, general
// answer is: whenever this isn't a real channel slug, hand the request to
// the real static-asset resolver and return whatever it says (the real file,
// or its own genuine 404) rather than assuming.
import { breadcrumbJsonLd, breadcrumbHTML } from '../shared/http.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.slice(1));

  if (!slug) return env.ASSETS.fetch(request);

  let creator;
  try {
    creator = await env.DB.prepare(
      `SELECT channel_name, description, thumbnail_url, youtube_channel_id, slug, category, tier FROM channels WHERE slug = ? AND status = 'approved'`
    )
      .bind(slug)
      .first();
  } catch (err) {
    return new Response('Temporarily unavailable.', { status: 503 });
  }

  if (!creator) return env.ASSETS.fetch(request);

  const assetUrl = new URL('/templates/creator.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  const title = `${creator.channel_name} | GorkhaTV`;
  const description = creator.description
    ? creator.description.slice(0, 160)
    : `${creator.channel_name} on GorkhaTV — Darjeeling-region YouTube creator.`;
  const pageUrl = `${url.origin}/${creator.slug}`;

  // ProfilePage is Google's structured-data type for a creator profile; its
  // mainEntity is the channel itself — a Person for individual creators, an
  // Organization for news outlets, studios, bands and media channels
  // (e.g. Khabar Darjeeling), which were all previously marked as Person.
  const structuredData = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: pageUrl,
    mainEntity: {
      '@type': isOrganization(creator) ? 'Organization' : 'Person',
      name: creator.channel_name,
      description,
      url: pageUrl,
      ...(creator.thumbnail_url ? { image: creator.thumbnail_url } : {}),
      sameAs: [`https://www.youtube.com/channel/${creator.youtube_channel_id}`],
    },
  });

  const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${pageUrl}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    ${creator.thumbnail_url ? `<meta property="og:image" content="${escapeHtml(creator.thumbnail_url)}">` : ''}
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    ${creator.thumbnail_url ? `<meta name="twitter:image" content="${escapeHtml(creator.thumbnail_url)}">` : ''}
    <script type="application/ld+json">${structuredData}</script>
    <script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', url: url.origin }, { name: creator.channel_name, url: pageUrl }])}</script>
    `;

  html = html.replace(/<title>.*?<\/title>/i, '');
  html = html.replace(/<head>/i, `<head>${metaTags}`);
  html = html.replace('<!-- BREADCRUMB-PLACEHOLDER -->', breadcrumbHTML([{ name: 'Home', url: url.origin }, { name: creator.channel_name, url: pageUrl }]));

  return new Response(html, {
    headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}

// No explicit person/organization flag exists on channels, so this infers
// one: news channels, verified reporters and CHIMAL Originals are outlets,
// and names with unambiguous outlet/studio words ("Khabar Darjeeling",
// "XYZ Films", "ABC Records", "Darjeeling Times") are organizations.
// Deliberately conservative — "Official"/"Music" are left out because solo
// artists use them as often as groups do — so everything else, the large
// majority of individual vloggers and artists, stays a Person.
const ORGANIZATION_NAME = /\b(news|khabar|samachar|tv|media|films?|productions?|studios?|records|entertainment|band|network|pictures|times|express)\b/i;

function isOrganization(creator) {
  if (creator.category === 'news' || creator.tier === 'verified_reporter' || creator.tier === 'chimal_original') return true;
  return ORGANIZATION_NAME.test(creator.channel_name || '');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
