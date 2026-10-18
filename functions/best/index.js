// /best — hub linking every non-thin "best of" collection and every
// location × category page, so each one is a click from the footer's
// "Best of" link (and so crawlers find them from one page).
import { COLLECTIONS, MIN_ITEMS, collectionSizes, locationCategoryCombos, categoryPhrase } from '../../shared/collections.js';
import { LOCATIONS } from '../../shared/constants.js';
import { renderCollectionPage } from '../../shared/render-collection.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let sizes, combos;
  try {
    [sizes, combos] = await Promise.all([collectionSizes(env.DB), locationCategoryCombos(env.DB)]);
  } catch (err) {
    return new Response('Temporarily unavailable.', { status: 503 });
  }

  const pageUrl = `${url.origin}/best`;
  const cards = COLLECTIONS.filter((c) => sizes.get(c.slug) >= MIN_ITEMS).map((c) => ({ href: `/best/${c.slug}`, title: c.h1, sub: c.card }));

  return renderCollectionPage(env, url, {
    title: 'Best of the Darjeeling Hills on YouTube | GorkhaTV',
    description: 'Hand-picked collections of the best videos from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and Sikkim — top creators, films, comedy, vlogs, food, travel and local news.',
    canonical: pageUrl,
    badge: 'GorkhaTV Best of',
    h1: 'Best of the Darjeeling Hills',
    intro: 'The most-watched videos and creators from the Darjeeling hills and Sikkim, gathered into collections — plus every place on GorkhaTV broken down by what people there make, from local news to food and music.',
    itemListName: 'GorkhaTV collections',
    cards,
    sections: LOCATIONS.map((loc) => ({
      heading: `From ${loc}`,
      links: combos
        .filter((c) => c.location === loc)
        .map((c) => ({ href: `/location/${encodeURIComponent(loc)}/${encodeURIComponent(c.category)}`, label: `${loc} ${categoryPhrase(c.category, c.label)}` })),
    })),
    breadcrumbs: [
      { name: 'Home', url: url.origin },
      { name: 'Best of', url: pageUrl },
    ],
  });
}
