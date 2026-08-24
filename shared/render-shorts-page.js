// Shared by functions/shorts.js (bare /shorts) and functions/shorts/[id].js
// (/shorts/:id deep links) — serves templates/shorts.html, injecting
// per-video OG/Twitter tags server-side when a specific id is in the path,
// same pattern as functions/watch/[id].js.
export async function renderShortsPage(env, url, id) {
  const assetUrl = new URL('/templates/shorts.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!id) {
    return new Response(html, { headers: res.headers });
  }

  try {
    const video = await env.DB.prepare(
      `SELECT title, thumbnail_url, youtube_video_id, channel_name FROM videos WHERE youtube_video_id = ? AND status = 'published' AND content_type = 'short'`
    )
      .bind(id)
      .first();

    if (!video) {
      return new Response(html, { headers: res.headers });
    }

    const title = `${video.title} | GorkhaTV Shorts`;
    const description = `Watch ${video.channel_name ? `${video.channel_name}'s` : 'this'} Short on GorkhaTV — Darjeeling-region YouTube content.`;
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
    <meta name="twitter:image" content="${thumbnail}">
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
