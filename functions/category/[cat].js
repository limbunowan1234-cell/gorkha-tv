// Serves gorkhatv2/pages/browse.html for /category/:cat — injects a preset
// filter (window.__PRESET) plus SEO/OG meta tags server-side, so this is a
// real crawlable URL rather than a query-string-only view.

import { stripDefaultSeoTags } from '../../shared/http.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cat = decodeURIComponent(url.pathname.split('/category/')[1] || '');

  const assetUrl = new URL('/pages/browse.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!cat) return new Response(html, { headers: res.headers });

  try {
    const category = await env.DB.prepare('SELECT slug, label FROM categories WHERE slug = ? AND active = 1').bind(cat).first();
    const label = category?.label || capitalize(cat);
    const title = `${label} Videos | GorkhaTV`;
    const description = `Watch ${label.toLowerCase()} videos from the Darjeeling hills — Darjeeling, Kalimpong, Kurseong, Mirik and Siliguri — curated on GorkhaTV.`;
    const pageUrl = `${url.origin}/category/${encodeURIComponent(cat)}`;

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
    <script>window.__PRESET = ${JSON.stringify({ category: cat })};</script>
    `;

    html = stripDefaultSeoTags(html);
    html = html.replace(/<head>/i, `<head>${injected}`);

    return new Response(html, { headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' } });
  } catch (err) {
    return new Response(html, { headers: res.headers });
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
