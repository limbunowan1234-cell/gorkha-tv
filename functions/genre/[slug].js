// Serves gorkhatv2/templates/genre.html for /genre/:slug — injects the
// genre's theme color/label plus SEO/OG meta tags server-side, same SSR
// pattern as functions/category/[cat].js. Only the 5 real category-backed
// genres live here; Shorts ("GorkhaTV Flash") is a themed link straight to
// the existing pages/feed.html, not a page of its own — see gorkhatv2/js/genres.js.
import { stripDefaultSeoTags } from '../../shared/http.js';

const GENRE_CONFIG = {
  movies: { category: 'movies', label: 'GorkhaTV Talkies', color: '#D4A017', kind: 'trending_latest', tagline: 'Movies from across the Darjeeling hills.' },
  music: { category: 'music', label: 'GorkhaTV Beats', color: '#E0479E', kind: 'top10_top100', tagline: "The hills' music, ranked by real engagement." },
  vlogs: { category: 'vlogs', label: 'GorkhaTV Diaries', color: '#2EC4B6', kind: 'trending_latest', tagline: 'Everyday stories from across the hills.' },
  news: { category: 'news', label: 'GorkhaTV Bulletin', color: '#1D7AE0', kind: 'trending_latest', tagline: 'Breaking news and updates from the Darjeeling hills, powered by Khabar Darjeeling.' },
  comedy: { category: 'comedy', label: 'GorkhaTV Laughs', color: '#FFD23F', kind: 'trending_latest', tagline: 'Comedy and laughs from the Darjeeling hills.' },
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

  const title = `${genre.label} | GorkhaTV`;
  const description = genre.tagline;
  const pageUrl = `${url.origin}/genre/${slug}`;

  const injected = `
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="${genre.color}">
  <script>window.__GENRE = ${JSON.stringify({ slug, ...genre })};</script>
  `;

  html = stripDefaultSeoTags(html);
  html = html.replace(/<head>/i, `<head>${injected}`);

  return new Response(html, {
    headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
