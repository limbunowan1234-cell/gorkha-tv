// /best/:slug — one "best of" collection (see shared/collections.js for the
// definitions and shared/render-collection.js for the page itself).
import { COLLECTIONS, MIN_ITEMS, findCollection, collectionItems, collectionSizes } from '../../shared/collections.js';
import { renderCollectionPage, videoRow, channelRow, notFound } from '../../shared/render-collection.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const collection = findCollection(params.slug);
  if (!collection) return notFound();

  let items, sizes;
  try {
    [items, sizes] = await Promise.all([collectionItems(env.DB, collection), collectionSizes(env.DB)]);
  } catch (err) {
    return new Response('Temporarily unavailable.', { status: 503 });
  }
  // Too thin to be worth indexing yet — see MIN_ITEMS.
  if (items.length < MIN_ITEMS) return notFound();

  const pageUrl = `${url.origin}/best/${collection.slug}`;
  const others = COLLECTIONS.filter((c) => c.slug !== collection.slug && sizes.get(c.slug) >= MIN_ITEMS);

  return renderCollectionPage(env, url, {
    title: collection.title,
    description: collection.description,
    canonical: pageUrl,
    badge: 'GorkhaTV Best of',
    h1: collection.h1,
    intro: collection.intro,
    items: items.map((v, i) => (collection.kind === 'channels' ? channelRow(v, i + 1) : videoRow(v, i + 1))),
    sections: [{ heading: 'More collections', links: others.map((c) => ({ href: `/best/${c.slug}`, label: c.h1 })) }],
    breadcrumbs: [
      { name: 'Home', url: url.origin },
      { name: 'Best of', url: `${url.origin}/best` },
      { name: collection.h1, url: pageUrl },
    ],
  });
}
