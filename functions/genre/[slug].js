// Serves gorkhatv2/templates/genre.html for /genre/:slug — injects the
// product's theme color/label plus SEO/OG meta tags server-side, same SSR
// pattern as functions/category/[cat].js. Only the real page-backed products
// live here (CHIMAL/KHABAR/SWARA); UKAALI (shorts) is a themed link straight
// to the existing pages/feed.html, not a page of its own — see
// gorkhatv2/js/genres.js.
import { stripDefaultSeoTags, breadcrumbJsonLd, breadcrumbHTML } from '../../shared/http.js';

const GENRE_CONFIG = {
  chimal: { categories: ['movies', 'shortfilms', 'comedy', 'entertainment', 'vlogs', 'magic'], label: 'CHIMAL', color: '#E8A62A', kind: 'multi_trending_latest', tagline: 'The home of Gorkha entertainment.',
    seoTitle: 'CHIMAL — Gorkha Movies, Short Films & Comedy | GorkhaTV',
    seoDescription: 'Watch Gorkha and Nepali movies, short films, web series, comedy and vlogs from Darjeeling, Kalimpong, Kurseong and Sikkim — all in one place on GorkhaTV.',
    image: '/images/menu-banners/chimal.jpg' },
  music: { category: 'music', label: 'SWARA', color: '#E6479D', kind: 'top10_top100', tagline: 'The home for all songs of Gorkha.',
    seoTitle: 'SWARA — Nepali & Gorkha Songs from Darjeeling | GorkhaTV',
    seoDescription: 'Listen to the latest Nepali and Gorkha songs from Darjeeling, Kalimpong and Sikkim — trending tracks and the Top 100 Hills Hits chart, ranked by engagement.',
    image: '/images/menu-banners/swara.jpg' },
  news: { category: 'news', label: 'KHABAR', color: '#3183F2', kind: 'trending_latest', tagline: 'Breaking news and updates from the Darjeeling hills, powered by Khabar Darjeeling.',
    seoTitle: 'KHABAR — Darjeeling News Today & Hills Updates | GorkhaTV',
    seoDescription: 'Latest Darjeeling news and video updates from Kalimpong, Kurseong, Mirik, Siliguri and the hills — bulletins powered by Khabar Darjeeling, on GorkhaTV.',
    image: '/images/menu-banners/khabar.jpg' },
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.split('/genre/')[1] || '');
  const genre = GENRE_CONFIG[slug];

  const assetUrl = new URL('/templates/genre.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!genre) return new Response(html, { status: 404, headers: res.headers });

  // seoTitle/seoDescription are search-facing (keyword-bearing, ~60/~155
  // chars); the short brand tagline stays the on-page copy via window.__GENRE.
  const title = genre.seoTitle;
  const description = genre.seoDescription;
  const image = `${url.origin}${genre.image}`;
  const pageUrl = `${url.origin}/genre/${slug}`;

  const injected = `
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1920">
  <meta property="og:image:height" content="1080">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="theme-color" content="${genre.color}">
  <script>window.__GENRE = ${JSON.stringify({ slug, ...genre })};</script>
  <script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', url: url.origin }, { name: genre.label, url: pageUrl }])}</script>
  `;

  html = stripDefaultSeoTags(html);
  html = html.replace(/<head>/i, `<head>${injected}`);
  html = html.replace('<!-- BREADCRUMB-PLACEHOLDER -->', breadcrumbHTML([{ name: 'Home', url: url.origin }, { name: genre.label, url: pageUrl }]));

  return new Response(html, {
    headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
