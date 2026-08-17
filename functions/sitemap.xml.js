// Filename must be exactly "sitemap.xml.js" — Cloudflare Pages Functions
// strip only the trailing ".js" from a filename to form the route, so this
// resolves to GET /sitemap.xml. Generated from D1 at request time (short
// edge-cacheable), replacing the old static sitemap.xml which only listed 4
// fixed URLs and would otherwise still reference now-deleted pages.

import { LOCATIONS } from '../shared/constants.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const origin = new URL(request.url).origin;

  const urls = [
    { loc: `${origin}/`, changefreq: 'hourly', priority: '1.0' },
    { loc: `${origin}/pages/browse.html`, changefreq: 'daily', priority: '0.8' },
    { loc: `${origin}/pages/search.html`, changefreq: 'weekly', priority: '0.4' },
    { loc: `${origin}/pages/submit-channel.html`, changefreq: 'monthly', priority: '0.5' },
  ];

  try {
    const [{ results: videos }, { results: creators }, { results: categories }] = await Promise.all([
      env.DB.prepare(`SELECT youtube_video_id, updated_at FROM videos WHERE status = 'published' ORDER BY published_at DESC LIMIT 2000`).all(),
      env.DB.prepare(`SELECT youtube_channel_id, updated_at FROM channels WHERE status = 'approved' LIMIT 500`).all(),
      env.DB.prepare(`SELECT slug FROM categories WHERE active = 1`).all(),
    ]);

    for (const v of videos) urls.push({ loc: `${origin}/watch/${v.youtube_video_id}`, lastmod: v.updated_at, changefreq: 'weekly', priority: '0.7' });
    for (const c of creators) urls.push({ loc: `${origin}/creator/${c.youtube_channel_id}`, lastmod: c.updated_at, changefreq: 'weekly', priority: '0.6' });
    for (const c of categories) urls.push({ loc: `${origin}/category/${c.slug}`, changefreq: 'daily', priority: '0.6' });
    for (const loc of LOCATIONS) urls.push({ loc: `${origin}/location/${encodeURIComponent(loc)}`, changefreq: 'daily', priority: '0.6' });
  } catch (err) {
    // A D1 hiccup should still return the static portion of the sitemap
    // rather than a 500 — crawlers get a smaller-but-valid sitemap.
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${String(u.lastmod).slice(0, 10)}</lastmod>` : ''}${
        u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''
      }${u.priority ? `<priority>${u.priority}</priority>` : ''}</url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=UTF-8', 'cache-control': 'public, max-age=3600' },
  });
}

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
