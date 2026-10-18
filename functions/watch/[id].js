// Cloudflare Pages Function — serves templates/watch.html for /watch/:id and
// injects SEO/OG/Twitter meta tags server-side (reads D1 directly, no HTTP
// round-trip through /api/*) so social crawlers see correct previews before
// any client-side JS runs. Also fills the page body's <h1>, meta line and
// description server-side, so the HTML crawlers download has the video's
// real content instead of a "Loading…" shell — js/watch.js re-renders the
// same elements with the same data once it loads. The "More like this"
// sidebar is server-rendered too (same list as /api/videos/:id/related), so
// every watch page links to up to 12 others in its raw HTML. Corrects a
// routing bug in the old
// functions/pages/video.js, which matched literal filename "video.js" ->
// route "/pages/video" and never actually intercepted "/pages/video.html".

import { breadcrumbJsonLd, breadcrumbHTML, metaDescription, videoJsonLd } from '../../shared/http.js';
import { findRelatedVideos } from '../../shared/related-videos.js';

// Categories whose slug is also a branded /genre/:slug page (see
// functions/genre/[slug].js's GENRE_CONFIG) — the breadcrumb links there
// instead of the generic /category/:slug grid. Only music and news qualify:
// movies/vlogs/comedy are rolled up under /genre/chimal, so /genre/movies
// etc. are 404s — those (and every other category) link to /category/:slug,
// which exists for every active category.
const GENRE_SLUGS = new Set(['music', 'news']);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.pathname.split('/watch/')[1];

  const assetUrl = new URL('/templates/watch.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!id) {
    return new Response(html, { headers: res.headers });
  }

  try {
    const video = await env.DB.prepare(
      `SELECT title, description, thumbnail_url, youtube_video_id, youtube_channel_id, channel_name, published_at, duration_seconds, category, location, view_count
       FROM videos WHERE youtube_video_id = ? AND status = 'published'`
    )
      .bind(id)
      .first();

    if (!video) {
      // Real 404 status (not a 200 "Loading…" shell) so unknown/removed
      // video ids aren't indexed as soft-404s. js/watch.js still renders its
      // own "Video not found" state on the page.
      return new Response(html, { status: 404, headers: res.headers });
    }

    // Related list is best-effort: a failure there renders the page without
    // it (js/watch.js still fetches it client-side), never fails the page.
    const [cat, related] = await Promise.all([
      video.category ? env.DB.prepare(`SELECT label FROM categories WHERE slug = ? AND active = 1`).bind(video.category).first() : null,
      findRelatedVideos(env.DB, video.youtube_video_id, video).catch(() => []),
    ]);
    const categoryLabel = video.category ? cat?.label || video.category.charAt(0).toUpperCase() + video.category.slice(1) : null;

    const title = `${video.title} | GorkhaTV`;
    const description = metaDescription(video.description, `Watch ${video.title} on GorkhaTV — Darjeeling-region YouTube content.`);
    const thumbnail = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
    const pageUrl = `${url.origin}/watch/${video.youtube_video_id}`;

    const structuredData = videoJsonLd(video, { pageUrl, description, thumbnail });

    const breadcrumbTrail = [{ name: 'Home', url: url.origin }];
    if (categoryLabel) {
      breadcrumbTrail.push({
        name: categoryLabel,
        url: GENRE_SLUGS.has(video.category) ? `${url.origin}/genre/${video.category}` : `${url.origin}/category/${encodeURIComponent(video.category)}`,
      });
    }
    breadcrumbTrail.push({ name: video.title, url: pageUrl });

    const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${pageUrl}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${thumbnail}">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:type" content="video.other">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${thumbnail}">
    <script type="application/ld+json">${structuredData}</script>
    <script type="application/ld+json">${breadcrumbJsonLd(breadcrumbTrail)}</script>
    `;

    html = html.replace(/<title>.*?<\/title>/i, '');
    html = html.replace(/<meta name="description"[^>]*>/i, '');
    html = html.replace(/<head>/i, `<head>${metaTags}`);
    html = html.replace('<!-- BREADCRUMB-PLACEHOLDER -->', breadcrumbHTML(breadcrumbTrail));

    // Body content — same elements and order js/watch.js's renderVideo()
    // fills (date · category · location · views), so there's no visible
    // jump when it re-renders them.
    const metaParts = [];
    if (video.published_at) metaParts.push(`<span>${escapeHtml(String(video.published_at).slice(0, 10))}</span>`);
    if (categoryLabel) metaParts.push(`<div class="dot"></div><span>${escapeHtml(categoryLabel)}</span>`);
    if (video.location) metaParts.push(`<div class="dot"></div><span>${escapeHtml(video.location)}</span>`);
    if (video.view_count) metaParts.push(`<div class="dot"></div><span>${escapeHtml(Number(video.view_count).toLocaleString('en-IN'))} views</span>`);
    html = html.replace('<h1 class="watch-title" id="watch-title">Loading…</h1>', `<h1 class="watch-title" id="watch-title">${escapeHtml(video.title)}</h1>`);
    html = html.replace('<div class="watch-meta" id="watch-meta"></div>', `<div class="watch-meta" id="watch-meta">${metaParts.join('')}</div>`);
    html = html.replace('<p class="watch-desc clamped" id="watch-desc"></p>', `<p class="watch-desc clamped" id="watch-desc">${escapeHtml(video.description || '')}</p>`);
    if (related.length) {
      // Replaces the loading spinner (rest of that template line) with the
      // same markup js/watch.js's relatedItemHTML() produces.
      html = html.replace(/<div class="related-list" id="related-list">.*/, `<div class="related-list" id="related-list">${related.map(relatedItemHTML).join('')}</div>`);
    }

    return new Response(html, {
      headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (err) {
    return new Response(html, { headers: res.headers });
  }
}

function relatedItemHTML(r) {
  const thumb = r.thumbnail_url || `https://img.youtube.com/vi/${r.youtube_video_id}/hqdefault.jpg`;
  return `
    <a class="related-item" href="/watch/${escapeHtml(r.youtube_video_id)}">
      <div class="related-thumb"><img src="${escapeHtml(thumb)}" loading="lazy" alt="" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(r.youtube_video_id)}/default.jpg'"></div>
      <div>
        <div class="related-title">${escapeHtml(r.title)}</div>
        <div class="related-sub">${escapeHtml(r.channel_name || '')}</div>
      </div>
    </a>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
