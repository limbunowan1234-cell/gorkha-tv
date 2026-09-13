// Serves gorkhatv2/templates/chart.html for GET /pages/chart.html — the
// filename's ".html.js" is deliberate: Cloudflare Pages Functions strip
// only the trailing ".js" to form a route, so "chart.html.js" -> the exact
// route "/pages/chart.html" (unlike a plain "chart.js", which would map to
// "/pages/chart" instead — see functions/watch/[id].js's own comment about
// the old functions/pages/video.js bug this exact naming avoids repeating).
//
// The Top 100 list itself was previously a static HTML file with generic,
// unchanging meta tags — this converts it into a real SSR route so it can
// carry ItemList structured data reflecting the actual current ranking
// (real content, not a placeholder), same SSR pattern as watch/genre/
// category/location/creator pages.

import { breadcrumbJsonLd, breadcrumbHTML } from '../../shared/http.js';

const VIDEO_COLUMNS = 'youtube_video_id, title, channel_name, duration_seconds';
const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";
const ENGAGEMENT_EXPR = '(view_count + COALESCE(like_count, 0) * 10)';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const assetUrl = new URL('/templates/chart.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  const pageUrl = `${url.origin}/pages/chart.html`;
  const breadcrumbTrail = [
    { name: 'Home', url: url.origin },
    { name: 'GorkhaTV Beats', url: `${url.origin}/genre/music` },
    { name: 'Top 100 Hills Hits', url: pageUrl },
  ];

  try {
    const { results } = await env.DB.prepare(
      `SELECT ${VIDEO_COLUMNS} FROM videos
       WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND category = 'music'
       ORDER BY ${ENGAGEMENT_EXPR} DESC, published_at DESC
       LIMIT 100`
    ).all();

    const itemListJsonLd = safeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Top 100 Hills Hits — GorkhaTV Beats',
      description: "The Darjeeling hills and Sikkim's music, ranked by real engagement.",
      numberOfItems: results.length,
      itemListElement: results.map((v, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'MusicRecording',
          name: v.title,
          url: `${url.origin}/watch/${v.youtube_video_id}`,
          ...(v.channel_name ? { byArtist: { '@type': 'MusicGroup', name: v.channel_name } } : {}),
          ...(v.duration_seconds ? { duration: `PT${v.duration_seconds}S` } : {}),
        },
      })),
    });

    const injected = `
    <script type="application/ld+json">${itemListJsonLd}</script>
    <script type="application/ld+json">${breadcrumbJsonLd(breadcrumbTrail)}</script>
    `;

    html = html.replace(/<head>/i, `<head>${injected}`);
    html = html.replace('<!-- BREADCRUMB-PLACEHOLDER -->', breadcrumbHTML(breadcrumbTrail));

    return new Response(html, {
      headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (err) {
    // A D1 hiccup should still serve the page (client-side js/chart.js
    // fetches /api/chart itself and handles its own empty/error state) —
    // just without the structured data/breadcrumb this run.
    return new Response(html, { headers: res.headers });
  }
}

// See functions/creator/[id].js for why '<' must be escaped in embedded JSON-LD.
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
