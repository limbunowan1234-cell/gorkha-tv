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
    // News gets real branding here (and in gorkhatv2/js/browse.js's on-page
    // title/subtitle) since it's promoted to its own destination rather than
    // a homepage row — see functions/api/home.js for the homepage side of
    // this. Khabar Darjeeling is a real, already-approved channel on the
    // platform (channels.slug = 'khabardarjeeling'); this is an editorial
    // credit, not a content filter — the feed below still shows every
    // published news video from every source channel.
    const title = cat === 'news' ? 'Gorkha TV News — Powered by Khabar Darjeeling | GorkhaTV' : `${label} Videos | GorkhaTV`;
    const description =
      cat === 'news'
        ? 'Breaking news and updates from across the Darjeeling hills, brought to you by Gorkha TV in partnership with Khabar Darjeeling.'
        : `Watch ${label.toLowerCase()} videos from the Darjeeling hills — Darjeeling, Kalimpong, Kurseong, Mirik and Siliguri — curated on GorkhaTV.`;
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
