// Filename must be exactly "sitemap.xml.js" — Cloudflare Pages Functions
// strip only the trailing ".js" from a filename to form the route, so this
// resolves to GET /sitemap.xml. Generated from D1 at request time (short
// edge-cacheable), replacing the old static sitemap.xml which only listed 4
// fixed URLs and would otherwise still reference now-deleted pages.

import { LOCATIONS } from '../shared/constants.js';
import { COLLECTIONS, MIN_ITEMS, collectionSizes, locationCategoryCombos, comboUrl } from '../shared/collections.js';

// How many watch pages to submit: the most-engaged, plus the newest uploads.
const TOP_VIDEOS = 1500;
const NEW_VIDEOS = 500;

export async function onRequestGet(context) {
  const { env, request } = context;
  const origin = new URL(request.url).origin;

  // CHIMAL/SWARA/KHABAR — the branded genre pages. Must match the keys of
  // functions/genre/[slug].js's GENRE_CONFIG exactly: any other slug is a
  // 404 there, and listing a 404 here wastes crawl budget and shows up as a
  // sitemap error in Search Console. SWARA's "See all" points at chart.html,
  // which needs its own sitemap entry too.
  const GENRE_SLUGS = ['chimal', 'music', 'news'];

  const urls = [
    { loc: `${origin}/`, changefreq: 'hourly', priority: '1.0' },
    // Extensionless: Cloudflare Pages 308-redirects /pages/x.html -> /pages/x,
    // so listing the .html form would point crawlers at a redirect.
    // chart.html is the exception — it's a Function route
    // (functions/pages/chart.html.js) and serves 200 at that exact path.
    // search/terms/privacy are left out: they're noindex, and a sitemap
    // should only list pages meant to be indexed.
    { loc: `${origin}/pages/browse`, changefreq: 'daily', priority: '0.8' },
    { loc: `${origin}/shorts`, changefreq: 'hourly', priority: '0.9' },
    { loc: `${origin}/pages/feed`, changefreq: 'hourly', priority: '0.8' },
    { loc: `${origin}/pages/chart.html`, changefreq: 'daily', priority: '0.7' },
    { loc: `${origin}/pages/submit-channel`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${origin}/pages/about`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${origin}/pages/contact`, changefreq: 'monthly', priority: '0.3' },
    ...GENRE_SLUGS.map((slug) => ({ loc: `${origin}/genre/${slug}`, changefreq: 'daily', priority: '0.8' })),
    { loc: `${origin}/best`, changefreq: 'weekly', priority: '0.7' },
  ];

  try {
    // Google's own single-sitemap cap is 50,000 URLs — 20,000 here is
    // generous headroom over today's ~4,600 published videos, not a limit
    // chosen to match Google's. Revisit only if the catalog grows enough to
    // approach 20k (a <sitemapindex> splitting into multiple files would be
    // the next step, well before ever nearing Google's real ceiling).
    // Only the videos worth a Google visit. Listing all ~8.7k URLs made Google
    // crawl thousands of near-identical YouTube-embed pages and decline to
    // index most of them ("Crawled/Discovered - currently not indexed"),
    // which also drags down how it rates the good pages. Shorts pages are left
    // out (a full-screen player with ~200 characters of text); watch pages are
    // limited to the most-engaged plus the newest uploads.
    const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
    const [{ results: topVideos }, { results: newVideos }, { results: creators }, { results: categories }] = await Promise.all([
      env.DB.prepare(`SELECT youtube_video_id, content_type, updated_at FROM videos WHERE status = 'published' AND ${NOT_SHORT} ORDER BY (COALESCE(view_count,0) + COALESCE(like_count,0) * 10) DESC LIMIT ${TOP_VIDEOS}`).all(),
      env.DB.prepare(`SELECT youtube_video_id, content_type, updated_at FROM videos WHERE status = 'published' AND ${NOT_SHORT} ORDER BY published_at DESC LIMIT ${NEW_VIDEOS}`).all(),
      env.DB.prepare(`SELECT slug, updated_at FROM channels WHERE status = 'approved' AND slug IS NOT NULL LIMIT 2000`).all(),
      env.DB.prepare(`SELECT slug FROM categories WHERE active = 1`).all(),
    ]);

    const seen = new Set();
    for (const v of [...topVideos, ...newVideos]) {
      if (seen.has(v.youtube_video_id)) continue;
      seen.add(v.youtube_video_id);
      urls.push({ loc: `${origin}/watch/${v.youtube_video_id}`, lastmod: v.updated_at, changefreq: 'weekly', priority: '0.7' });
    }
    for (const c of creators) urls.push({ loc: `${origin}/${c.slug}`, lastmod: c.updated_at, changefreq: 'weekly', priority: '0.6' });
    for (const c of categories) urls.push({ loc: `${origin}/category/${c.slug}`, changefreq: 'daily', priority: '0.6' });
    for (const loc of LOCATIONS) urls.push({ loc: `${origin}/location/${encodeURIComponent(loc)}`, changefreq: 'daily', priority: '0.6' });

    // Collections and location × category pages — only the ones with enough
    // videos to render (thinner ones 404, see shared/collections.js).
    const [sizes, combos] = await Promise.all([collectionSizes(env.DB), locationCategoryCombos(env.DB)]);
    for (const c of COLLECTIONS) if (sizes.get(c.slug) >= MIN_ITEMS) urls.push({ loc: `${origin}/best/${c.slug}`, changefreq: 'weekly', priority: '0.7' });
    for (const c of combos) urls.push({ loc: comboUrl(origin, c.location, c.category), changefreq: 'daily', priority: '0.6' });
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
