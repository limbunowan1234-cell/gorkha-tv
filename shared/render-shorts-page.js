// Shared by functions/shorts.js (bare /shorts) and functions/shorts/[id].js
// (/shorts/:id deep links) — serves templates/shorts.html, injecting
// per-video OG/Twitter tags server-side when a specific id is in the path,
// same pattern as functions/watch/[id].js — including VideoObject and
// BreadcrumbList structured data, and a visually-hidden <h1> with the
// video's title (the swipe UI has no visible heading of its own).
import { stripDefaultSeoTags, breadcrumbJsonLd, metaDescription, videoJsonLd } from './http.js';

export async function renderShortsPage(env, url, id) {
  const assetUrl = new URL('/templates/shorts.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!id) {
    return new Response(html, { headers: res.headers });
  }

  try {
    const video = await env.DB.prepare(
      `SELECT title, description, thumbnail_url, youtube_video_id, channel_name, published_at, duration_seconds, view_count FROM videos WHERE youtube_video_id = ? AND status = 'published' AND content_type = 'short'`
    )
      .bind(id)
      .first();

    if (!video) {
      // Real 404 status so unknown/removed short ids aren't soft-404s — see
      // functions/watch/[id].js.
      return new Response(html, { status: 404, headers: res.headers });
    }

    const title = `${video.title} | GorkhaTV Shorts`;
    const description = metaDescription(
      video.description,
      `Watch ${video.channel_name ? `${video.channel_name}'s` : 'this'} Short on GorkhaTV — Darjeeling-region YouTube content.`
    );
    const thumbnail = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
    const pageUrl = `${url.origin}/shorts/${video.youtube_video_id}`;

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
    <script type="application/ld+json">${videoJsonLd(video, { pageUrl, description, thumbnail })}</script>
    <script type="application/ld+json">${breadcrumbJsonLd([
      { name: 'Home', url: url.origin },
      { name: 'Shorts', url: `${url.origin}/shorts` },
      { name: video.title, url: pageUrl },
    ])}</script>
    `;

    // templates/shorts.html now carries its own static canonical/OG/Twitter
    // tags for the bare /shorts case — strip all of them (not just
    // title/description) before injecting the per-video versions, or a
    // deep-linked /shorts/:id page ends up with two conflicting canonical
    // tags and duplicate og:title/og:image.
    html = stripDefaultSeoTags(html);
    html = html.replace(/<head>/i, `<head>${metaTags}`);
    // Inline clip styles rather than a shared class: this is the only
    // visually-hidden element on the site.
    html = html.replace(
      '<div class="shorts-feed" id="shorts-feed">',
      `<h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">${escapeHtml(video.title)}</h1>\n<div class="shorts-feed" id="shorts-feed">`
    );

    return new Response(html, {
      headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (err) {
    return new Response(html, { headers: res.headers });
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
