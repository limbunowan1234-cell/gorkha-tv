// functions/pages/artist.js
// Cloudflare Pages Function — intercepts /pages/artist.html requests,
// fetches the artist doc from Appwrite (by slug), and injects SEO meta
// tags server-side so social crawlers see correct previews.

const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const PROJECT_ID = "6a280cbd0022eeb574a5";
const DB_ID = "6a280cde0009e6b2b556";
const ARTISTS_COLLECTION_ID = "artists";
const BUCKET_ID = "6a280d4100046ab86533";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("id");

  const assetUrl = new URL("/pages/artist.html", url.origin);
  const res = await env.ASSETS.fetch(assetUrl.toString());
  let html = await res.text();

  if (!slug) {
    return new Response(html, { headers: res.headers });
  }

  try {
    const apiRes = await fetch(
      `${APPWRITE_ENDPOINT}/databases/${DB_ID}/collections/${ARTISTS_COLLECTION_ID}/documents?queries[]=${encodeURIComponent(
        JSON.stringify({ method: "equal", attribute: "slug", values: [slug] })
      )}`,
      {
        headers: {
          "X-Appwrite-Project": PROJECT_ID,
        },
      }
    );

    if (!apiRes.ok) {
      return new Response(html, { headers: res.headers });
    }

    const data = await apiRes.json();
    const artist = data.documents && data.documents[0];

    if (!artist) {
      return new Response(html, { headers: res.headers });
    }

    const title = `${artist.name} — ${artist.profession || "Artist"} | GorkhaTV`;
    const description = artist.bio
      ? artist.bio.slice(0, 160)
      : `${artist.name} on GorkhaTV — ${artist.profession || "artist"}${
          artist.location ? " from " + artist.location : ""
        }. View filmography and credits.`;
    const image = artist.photoFiled
      ? `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${artist.photoFiled}/view?project=${PROJECT_ID}`
      : "https://gorkhatv.site/logo-circle.png";
    const pageUrl = `https://gorkhatv.site/pages/artist.html?id=${artist.slug}`;

    const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${pageUrl}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">
    `;

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
