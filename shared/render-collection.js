// Renders templates/collection.html for the /best hub, /best/:slug and
// /location/:loc/:cat — everything on these pages is server-rendered
// (there's no client-side list JS), so crawlers get the full ranked list,
// its ItemList structured data and the cross-links in the raw HTML.
import { stripDefaultSeoTags, breadcrumbJsonLd, breadcrumbHTML } from './http.js';

// page: {
//   title, description, canonical, h1, badge?, intro,
//   items?: [{ href, rank, thumb, round?, title, sub }],   // ranked list
//   cards?: [{ href, title, sub }],                         // hub-style grid
//   sections?: [{ heading, links: [{ href, label }] }],     // cross-links
//   itemListName?, breadcrumbs: [{ name, url }]
// }
export async function renderCollectionPage(env, url, page) {
  const res = await env.ASSETS.fetch(new URL('/templates/collection.html', url.origin).toString());
  let html = await res.text();

  // Pages without their own image share the sitewide GorkhaTV card
  // (gorkhatv2/images/social/, cropped from the brand-pack YouTube banner).
  page = { image: `${url.origin}/images/social/gorkhatv-share-1200x630.jpg`, ...page };
  const listUrls = page.items?.length ? page.items.map((i) => `${url.origin}${i.href}`) : (page.cards || []).map((c) => `${url.origin}${c.href}`);
  const itemList = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page.itemListName || page.h1,
    numberOfItems: listUrls.length,
    itemListElement: listUrls.map((u, i) => ({ '@type': 'ListItem', position: i + 1, url: u })),
  }).replace(/</g, '\\u003c');

  const head = `
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <link rel="canonical" href="${page.canonical}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${page.canonical}">
  <meta property="og:type" content="website">
  ${page.image ? `<meta property="og:image" content="${escapeHtml(page.image)}">` : ''}
  <meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  ${page.image ? `<meta name="twitter:image" content="${escapeHtml(page.image)}">` : ''}
  <script type="application/ld+json">${itemList}</script>
  <script type="application/ld+json">${breadcrumbJsonLd(page.breadcrumbs)}</script>
  `;

  const body = [
    page.badge ? `<div class="coll-badge">${escapeHtml(page.badge)}</div>` : '',
    `<h1 class="coll-title">${escapeHtml(page.h1)}</h1>`,
    `<p class="coll-intro">${escapeHtml(page.intro)}</p>`,
    page.items?.length ? `<div class="coll-list">${page.items.map(rowHTML).join('')}</div>` : '',
    page.cards?.length ? `<div class="coll-cards">${page.cards.map(cardHTML).join('')}</div>` : '',
    ...(page.sections || [])
      .filter((s) => s.links.length)
      .map(
        (s) =>
          `<section class="coll-section"><h2>${escapeHtml(s.heading)}</h2><div class="coll-links">${s.links
            .map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`)
            .join('')}</div></section>`
      ),
  ].join('\n');

  html = stripDefaultSeoTags(html);
  html = html.replace(/<head>/i, `<head>${head}`);
  html = html.replace('<!-- BREADCRUMB-PLACEHOLDER -->', breadcrumbHTML(page.breadcrumbs));
  html = html.replace('<!-- COLLECTION-BODY -->', body);

  return new Response(html, {
    headers: { ...Object.fromEntries(res.headers), 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=300, s-maxage=600' },
  });
}

function rowHTML(item) {
  return `
  <a class="coll-row" href="${escapeHtml(item.href)}">
    <div class="coll-rank">${item.rank}</div>
    <div class="coll-thumb${item.round ? ' round' : ''}">${item.thumb ? `<img src="${escapeHtml(item.thumb)}" loading="lazy" alt="">` : ''}</div>
    <div class="coll-info">
      <div class="coll-row-title">${escapeHtml(item.title)}</div>
      <div class="coll-row-sub">${escapeHtml(item.sub || '')}</div>
    </div>
  </a>`;
}

function cardHTML(card) {
  return `<a class="coll-card" href="${escapeHtml(card.href)}"><strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(card.sub || '')}</span></a>`;
}

// Row helpers shared by the routes.
export function videoRow(v, rank, { showDate = false } = {}) {
  const sub = [v.channel_name, formatViews(v.view_count), showDate && v.published_at ? String(v.published_at).slice(0, 10) : '']
    .filter(Boolean)
    .join(' · ');
  return {
    href: `/watch/${v.youtube_video_id}`,
    rank,
    thumb: v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_video_id}/hqdefault.jpg`,
    title: v.title,
    sub,
  };
}

export function channelRow(c, rank) {
  return {
    href: `/${c.slug}`,
    rank,
    thumb: c.thumbnail_url,
    round: true,
    title: c.channel_name,
    sub: [`${c.video_count} video${c.video_count === 1 ? '' : 's'}`, formatViews(c.total_views)].filter(Boolean).join(' · '),
  };
}

// Same output as gorkhatv2/js/api.js's formatViews().
export function formatViews(n) {
  if (!n) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${n} view${n === 1 ? '' : 's'}`;
}

export function notFound() {
  return new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
