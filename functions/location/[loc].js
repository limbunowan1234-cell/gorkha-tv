// Serves gorkhatv2/pages/browse.html for /location/:loc — injects a preset
// filter (window.__PRESET) plus SEO/OG meta tags server-side.

import { LOCATIONS } from '../../shared/constants.js';
import { stripDefaultSeoTags } from '../../shared/http.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const loc = decodeURIComponent(url.pathname.split('/location/')[1] || '');

  const assetUrl = new URL('/pages/browse.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!loc || !LOCATIONS.includes(loc)) return new Response(html, { headers: res.headers });

  const title = `${loc} Videos | GorkhaTV`;
  const description = `Discover YouTube videos from ${loc} — news, vlogs, travel, food, culture and more — curated on GorkhaTV.`;
  const pageUrl = `${url.origin}/location/${encodeURIComponent(loc)}`;

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
    <script>window.__PRESET = ${JSON.stringify({ location: loc })};</script>
    `;

  html = stripDefaultSeoTags(html);
  html = html.replace(/<head>/i, `<head>${injected}`);

  return new Response(html, { headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' } });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
