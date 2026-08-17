// Serves templates/creator.html for /creator/:id and injects SEO/OG meta
// tags server-side from D1, same pattern as functions/watch/[id].js.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.pathname.split('/creator/')[1];

  const assetUrl = new URL('/templates/creator.html', url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!id) return new Response(html, { headers: res.headers });

  try {
    const creator = await env.DB.prepare(
      `SELECT channel_name, description, thumbnail_url, youtube_channel_id FROM channels WHERE youtube_channel_id = ? AND status = 'approved'`
    )
      .bind(id)
      .first();

    if (!creator) return new Response(html, { headers: res.headers });

    const title = `${creator.channel_name} | GorkhaTV`;
    const description = creator.description
      ? creator.description.slice(0, 160)
      : `${creator.channel_name} on GorkhaTV — Darjeeling-region YouTube creator.`;
    const pageUrl = `${url.origin}/creator/${creator.youtube_channel_id}`;

    const structuredData = safeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: creator.channel_name,
      description,
      url: pageUrl,
      ...(creator.thumbnail_url ? { image: creator.thumbnail_url } : {}),
      sameAs: [`https://www.youtube.com/channel/${creator.youtube_channel_id}`],
    });

    const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${pageUrl}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    ${creator.thumbnail_url ? `<meta property="og:image" content="${escapeHtml(creator.thumbnail_url)}">` : ''}
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    ${creator.thumbnail_url ? `<meta name="twitter:image" content="${escapeHtml(creator.thumbnail_url)}">` : ''}
    <script type="application/ld+json">${structuredData}</script>
    `;

    html = html.replace(/<title>.*?<\/title>/i, '');
    html = html.replace(/<head>/i, `<head>${metaTags}`);

    return new Response(html, { headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=60, s-maxage=300' } });
  } catch (err) {
    return new Response(html, { headers: res.headers });
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// JSON.stringify never escapes '<' — if a channel name/description ever
// contained the literal text "</script>", it would prematurely close the
// script tag and let arbitrary HTML/script run. Escaping '<' as a unicode
// sequence is JSON-valid and defeats that regardless of case/whitespace
// tricks.
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
