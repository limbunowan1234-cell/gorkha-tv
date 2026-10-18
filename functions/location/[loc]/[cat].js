// /location/:loc/:cat — e.g. /location/Kalimpong/news. A server-rendered
// ranked list of one category's videos from one place, targeting searches
// like "kalimpong news" or "darjeeling food videos". Only combinations with
// at least MIN_ITEMS videos exist (others 404); see shared/collections.js.
import {
  MIN_ITEMS,
  canonicalLocation,
  categoryPhrase,
  comboUrl,
  locationCategoryCombos,
  locationCategoryItems,
} from '../../../shared/collections.js';
import { renderCollectionPage, videoRow, notFound } from '../../../shared/render-collection.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const location = canonicalLocation(params.loc);
  const category = String(params.cat).toLowerCase();
  if (!location) return notFound();

  // One canonical casing (/location/Kalimpong/news) so /location/kalimpong/News
  // etc. don't become duplicate URLs.
  if (location !== params.loc || category !== params.cat) {
    return Response.redirect(comboUrl(url.origin, location, category), 301);
  }

  let combos, items;
  try {
    [combos, items] = await Promise.all([locationCategoryCombos(env.DB), locationCategoryItems(env.DB, location, category)]);
  } catch (err) {
    return new Response('Temporarily unavailable.', { status: 503 });
  }
  const combo = combos.find((c) => c.location === location && c.category === category);
  if (!combo || items.length < MIN_ITEMS) return notFound();

  const phrase = categoryPhrase(category, combo.label);
  const isNews = category === 'news';
  const pageUrl = comboUrl(url.origin, location, category);
  const channels = `${combo.channels} local YouTube channel${combo.channels === 1 ? '' : 's'}`;

  const title = isNews ? `${location} News Today — Latest Video Updates | GorkhaTV` : `${location} ${phrase} | GorkhaTV`;
  const description = isNews
    ? `The latest news videos from ${location} — ${combo.n} bulletins and reports from ${channels}, newest first. On GorkhaTV.`
    : `The most-watched ${phrase.toLowerCase()} from ${location} — ${combo.n} videos from ${channels}, ranked by viewer engagement. On GorkhaTV.`;
  const intro = isNews
    ? `The latest news from ${location}, newest first — ${combo.n} video bulletins and reports from ${channels}, updated as they publish.`
    : `${phrase} from ${location}, ranked by how much viewers watch and like them — the top ${items.length} of ${combo.n} videos from ${channels}.`;

  return renderCollectionPage(env, url, {
    title,
    description,
    canonical: pageUrl,
    badge: location,
    h1: isNews ? `${location} News Today` : `${location} ${phrase}`,
    intro,
    items: items.map((v, i) => videoRow(v, i + 1, { showDate: isNews })),
    sections: [
      {
        heading: `More from ${location}`,
        links: combos
          .filter((c) => c.location === location && c.category !== category)
          .map((c) => ({ href: `/location/${encodeURIComponent(location)}/${encodeURIComponent(c.category)}`, label: `${location} ${categoryPhrase(c.category, c.label)}` })),
      },
      {
        heading: `${combo.label} from other places`,
        links: combos
          .filter((c) => c.category === category && c.location !== location)
          .map((c) => ({ href: `/location/${encodeURIComponent(c.location)}/${encodeURIComponent(category)}`, label: `${c.location} ${phrase}` })),
      },
      {
        heading: 'Browse',
        links: [
          { href: `/location/${encodeURIComponent(location)}`, label: `All videos from ${location}` },
          { href: `/category/${encodeURIComponent(category)}`, label: `All ${combo.label.toLowerCase()} videos` },
          { href: '/best', label: 'Best of the hills' },
        ],
      },
    ],
    breadcrumbs: [
      { name: 'Home', url: url.origin },
      { name: location, url: `${url.origin}/location/${encodeURIComponent(location)}` },
      { name: phrase, url: pageUrl },
    ],
  });
}
