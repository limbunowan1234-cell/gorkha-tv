// Cloudflare Pages Function — serves templates/watch.html for /watch/:id and
// injects SEO/OG/Twitter meta tags server-side (reads D1 directly, no HTTP
// round-trip through /api/*) so social crawlers see correct previews before
// any client-side JS runs. Corrects a routing bug in the old
// functions/pages/video.js, which matched literal filename "video.js" ->
// route "/pages/video" and never actually intercepted "/pages/video.html".

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
      `SELECT title, description, thumbnail_url, youtube_video_id, channel_name, published_at, duration_seconds
       FROM videos WHERE youtube_video_id = ? AND status = 'published'`
    )
      .bind(id)
      .first();

    if (!video) {
      return new Response(html, { headers: res.headers });
    }

    const title = `${video.title} | GorkhaTV`;
    const description = video.description ? video.description.slice(0, 160) : `Watch ${video.title} on GorkhaTV — Darjeeling-region YouTube content.`;
    const thumbnail = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
    const pageUrl = `${url.origin}/watch/${video.youtube_video_id}`;

    const structuredData = safeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: video.title,
      description,
      thumbnailUrl: [thumbnail],
      uploadDate: video.published_at,
      ...(video.duration_seconds ? { duration: `PT${video.duration_seconds}S` } : {}),
      embedUrl: `https://www.youtube.com/embed/${video.youtube_video_id}`,
      ...(video.channel_name ? { author: { '@type': 'Person', name: video.channel_name } } : {}),
    });

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
    `;

    html = html.replace(/<title>.*?<\/title>/i, '');
    html = html.replace(/<meta name="description"[^>]*>/i, '');
    html = html.replace(/<head>/i, `<head>${metaTags}`);

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

// See functions/creator/[id].js for why '<' must be escaped in embedded JSON-LD.
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
