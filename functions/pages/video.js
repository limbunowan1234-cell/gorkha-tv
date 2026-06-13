// functions/pages/video.js
// Cloudflare Pages Function — intercepts /pages/video.html requests,
// fetches the content doc from Appwrite, and injects SEO meta tags
// server-side so social crawlers (WhatsApp/FB/Twitter) see correct previews.

const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const PROJECT_ID = "6a280cbd0022eeb574a5";
const DB_ID = "6a280cde0009e6b2b556";
const COLLECTION_ID = "content"; // adjust if your collection id differs

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // Fetch the original static HTML from the Pages asset
  const assetUrl = new URL("/pages/video.html", url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!id) {
    return new Response(html, { headers: res.headers });
  }

  try {
    const apiRes = await fetch(
      `${APPWRITE_ENDPOINT}/databases/${DB_ID}/collections/${COLLECTION_ID}/documents/${id}`,
      {
        headers: {
          "X-Appwrite-Project": PROJECT_ID,
        },
      }
    );

    if (!apiRes.ok) {
      return new Response(html, { headers: res.headers });
    }

    const doc = await apiRes.json();

    const title = `${doc.title || "Watch"} | GorkhaTV`;
    const description = doc.description
      ? doc.description.slice(0, 160)
      : `Watch ${doc.title || "this video"} on GorkhaTV — Gorkha and Darjeeling entertainment.`;
    const thumbnail = doc.youtube_id
      ? `https://img.youtube.com/vi/${doc.youtube_id}/hqdefault.jpg`
      : "https://gorkhatv.site/logo-circle.png";
    const pageUrl = `https://gorkhatv.site/pages/video.html?id=${doc.$id}`;

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
    `;

    // Remove existing <title> tag, then inject our tags right after <head>
    html = html.replace(/<title>.*?<\/title>/i, "");
    html = html.replace(/<head>/i, `<head>${metaTags}`);

    return new Response(html, {
      headers: {
        ...Object.fromEntries(res.headers),
        "content-type": "text/html;charset=UTF-8",
      },
    });
  } catch (err) {
    return new Response(html, { headers: res.headers });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
