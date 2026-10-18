// Curated, data-driven landing pages for search: the "best of" collections
// (/best/:slug, functions/best/[slug].js), their hub (/best,
// functions/best/index.js) and the location × category pages
// (/location/:loc/:cat, functions/location/[loc]/[cat].js). Each one is a
// ranked list built from D1 at request time, so it stays current as the
// sync adds videos — the copy here is the only hand-written part.
//
// A page with fewer than MIN_ITEMS entries isn't worth indexing (thin
// content), so it 404s and is left out of the sitemap and the hub until the
// catalog grows into it.

import { LOCATIONS } from './constants.js';

export const MIN_ITEMS = 6;
const LIST_LIMIT = 30;

const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
// Same filter as the chart/home hero: drops sub-30s clips and hashtag-spam
// titles that are usually mis-classified Shorts.
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";
const ENGAGEMENT = '(view_count + COALESCE(like_count, 0) * 10)';
const VIDEO_COLUMNS = 'youtube_video_id, title, thumbnail_url, channel_name, view_count, published_at, duration_seconds';

// kind 'videos': top videos in `categories` by engagement.
// kind 'channels': creators ranked by total views across their indexed videos.
export const COLLECTIONS = [
  {
    slug: 'top-darjeeling-youtubers',
    kind: 'channels',
    title: 'Top Darjeeling YouTubers & Creators | GorkhaTV',
    h1: 'Top YouTubers from the Darjeeling Hills',
    description: 'The most-watched YouTube creators from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and Sikkim — vloggers, singers, filmmakers and news channels.',
    intro: 'The creators the hills watch most — ranked by total views across their videos on GorkhaTV. Vloggers, singers, filmmakers, comedians and local news channels from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and Sikkim.',
    card: 'The most-watched creators from the hills',
  },
  {
    slug: 'best-nepali-short-films',
    kind: 'videos',
    categories: ['shortfilms'],
    title: 'Best Nepali Short Films from Darjeeling & Sikkim | GorkhaTV',
    h1: 'Best Nepali Short Films from the Hills',
    description: 'Watch the most-loved Nepali short films made in Darjeeling, Kalimpong and Sikkim — ranked by real viewer engagement on YouTube.',
    intro: 'Short films made by independent filmmakers in the Darjeeling hills and Sikkim, ranked by how much viewers watch and like them. Every film plays free from the creator\'s own YouTube channel.',
    card: 'Independent films from local filmmakers',
  },
  {
    slug: 'best-gorkha-movies',
    kind: 'videos',
    categories: ['movies'],
    title: 'Best Gorkha & Nepali Movies to Watch Online | GorkhaTV',
    h1: 'Best Gorkha & Nepali Movies',
    description: 'The most-watched Gorkha and Nepali movies from the Darjeeling hills and Sikkim, free to stream on YouTube — ranked by viewer engagement.',
    intro: 'Full-length Gorkha and Nepali films from the Darjeeling hills and Sikkim that are free to watch on YouTube, ranked by real viewer engagement.',
    card: 'Full-length films, free on YouTube',
  },
  {
    slug: 'nepali-web-series',
    kind: 'videos',
    categories: ['webseries'],
    title: 'Nepali Web Series from Darjeeling | GorkhaTV',
    h1: 'Nepali Web Series from the Hills',
    description: 'Binge the most popular Nepali web series made in Darjeeling, Kalimpong and Sikkim — episodes ranked by viewer engagement.',
    intro: 'Web series episodes from creators across the Darjeeling hills and Sikkim, ranked by viewer engagement.',
    card: 'Episodic stories from local creators',
  },
  {
    slug: 'best-nepali-comedy-videos',
    kind: 'videos',
    categories: ['comedy'],
    title: 'Best Nepali Comedy Videos from Darjeeling | GorkhaTV',
    h1: 'Best Nepali Comedy from the Hills',
    description: 'The funniest Nepali comedy videos and sketches from Darjeeling, Kalimpong and Sikkim creators — ranked by views and likes.',
    intro: 'Sketches, skits and comedy videos from the Darjeeling hills and Sikkim, ranked by views and likes.',
    card: 'Sketches and skits the hills love',
  },
  {
    slug: 'best-darjeeling-vlogs',
    kind: 'videos',
    categories: ['vlogs'],
    title: 'Best Darjeeling Vlogs & Vloggers | GorkhaTV',
    h1: 'Best Vlogs from the Darjeeling Hills',
    description: 'Daily life, trips and stories from Darjeeling, Kalimpong, Kurseong and Sikkim — the most-watched vlogs from local YouTubers.',
    intro: 'Everyday life, trips and stories from local vloggers in Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and Sikkim — the most-watched first.',
    card: 'Life in the hills, from local vloggers',
  },
  {
    slug: 'darjeeling-travel-videos',
    kind: 'videos',
    categories: ['travel'],
    title: 'Darjeeling Travel Videos & Guides | GorkhaTV',
    h1: 'Darjeeling Travel Videos',
    description: 'Plan your trip with the most-watched travel videos from Darjeeling, Kalimpong, Mirik and Sikkim — made by creators who live there.',
    intro: 'Travel videos from Darjeeling, Kalimpong, Kurseong, Mirik and Sikkim, made by local creators — a good place to start planning a trip to the hills.',
    card: 'Trips and places, filmed by locals',
  },
  {
    slug: 'darjeeling-food-videos',
    kind: 'videos',
    categories: ['food'],
    title: 'Darjeeling Food Videos & Street Food Vlogs | GorkhaTV',
    h1: 'Darjeeling Food Videos',
    description: 'Local food, recipes and street-food vlogs from Darjeeling, Kalimpong and Sikkim — the most-watched food videos from the hills.',
    intro: 'Local food, recipes and street-food vlogs from across the Darjeeling hills and Sikkim, ranked by viewer engagement.',
    card: 'Local food, recipes and street food',
  },
  {
    slug: 'gorkha-culture-and-festivals',
    kind: 'videos',
    categories: ['culture', 'events'],
    title: 'Gorkha Culture & Festival Videos | GorkhaTV',
    h1: 'Gorkha Culture & Festivals',
    description: 'Festivals, traditions and cultural events of the Gorkha community in Darjeeling, Kalimpong and Sikkim — the most-watched videos.',
    intro: 'Festivals, traditions and cultural events from the Gorkha community across the Darjeeling hills and Sikkim, ranked by viewer engagement.',
    card: 'Festivals, traditions and events',
  },
  {
    slug: 'darjeeling-interviews',
    kind: 'videos',
    categories: ['interviews'],
    title: 'Interviews with Darjeeling Artists & Personalities | GorkhaTV',
    h1: 'Interviews from the Darjeeling Hills',
    description: 'Conversations with singers, actors, creators and public figures from Darjeeling, Kalimpong and Sikkim — the most-watched interviews.',
    intro: 'Conversations with singers, actors, creators and public figures from the Darjeeling hills and Sikkim, ranked by viewer engagement.',
    card: 'Conversations with local personalities',
  },
];

export function findCollection(slug) {
  return COLLECTIONS.find((c) => c.slug === slug) || null;
}

function categoryClause(categories) {
  return `category IN (${categories.map(() => '?').join(', ')})`;
}

export async function collectionItems(db, collection) {
  if (collection.kind === 'channels') {
    const { results } = await db
      .prepare(
        `SELECT c.slug, c.channel_name, c.thumbnail_url, COUNT(*) AS video_count, SUM(v.view_count) AS total_views
         FROM channels c JOIN videos v ON v.youtube_channel_id = c.youtube_channel_id AND v.status = 'published'
         WHERE c.status = 'approved' AND c.slug IS NOT NULL
         GROUP BY c.id ORDER BY total_views DESC LIMIT ${LIST_LIMIT}`
      )
      .all();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT ${VIDEO_COLUMNS} FROM videos
       WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND ${categoryClause(collection.categories)}
       ORDER BY ${ENGAGEMENT} DESC, published_at DESC LIMIT ${LIST_LIMIT}`
    )
    .bind(...collection.categories)
    .all();
  return results;
}

// How many entries each collection has available — the hub and sitemap
// compare these against MIN_ITEMS to skip thin collections.
export async function collectionSizes(db) {
  const sizes = await Promise.all(
    COLLECTIONS.map(async (c) => {
      if (c.kind === 'channels') {
        const row = await db
          .prepare(
            `SELECT COUNT(DISTINCT c.id) AS n FROM channels c JOIN videos v ON v.youtube_channel_id = c.youtube_channel_id AND v.status = 'published'
             WHERE c.status = 'approved' AND c.slug IS NOT NULL`
          )
          .first();
        return row?.n || 0;
      }
      const row = await db
        .prepare(`SELECT COUNT(*) AS n FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND ${categoryClause(c.categories)}`)
        .bind(...c.categories)
        .first();
      return row?.n || 0;
    })
  );
  return new Map(COLLECTIONS.map((c, i) => [c.slug, sizes[i]]));
}

// ---- Location × category ------------------------------------------------

// How each category reads after a place name in titles ("Kalimpong News",
// "Darjeeling Food Videos", "Kurseong Short Films"). Unlisted categories
// fall back to "<Label> Videos".
const CATEGORY_PHRASE = {
  news: 'News',
  vlogs: 'Vlogs',
  travel: 'Travel Videos',
  food: 'Food Videos',
  culture: 'Culture Videos',
  music: 'Songs & Music Videos',
  interviews: 'Interviews',
  entertainment: 'Entertainment Videos',
  sports: 'Sports Videos',
  events: 'Event Videos',
  movies: 'Movies',
  webseries: 'Web Series',
  shortfilms: 'Short Films',
  comedy: 'Comedy Videos',
  magic: 'Magic Videos',
};

export function categoryPhrase(slug, label) {
  return CATEGORY_PHRASE[slug] || `${label} Videos`;
}

// Case-insensitive lookup so /location/kalimpong/news works; callers 301 to
// the canonical casing.
export function canonicalLocation(loc) {
  return LOCATIONS.find((l) => l.toLowerCase() === String(loc).toLowerCase()) || null;
}

// Every (location, category) pair with enough videos to be worth a page,
// with counts — one GROUP BY over the (status, location/category)-indexed
// table. Feeds the sitemap, the hub and each page's sibling links.
export async function locationCategoryCombos(db) {
  const [{ results: rows }, { results: cats }] = await Promise.all([
    db
      .prepare(
        `SELECT location, category, COUNT(*) AS n, COUNT(DISTINCT youtube_channel_id) AS channels FROM videos
         WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND location IS NOT NULL AND category IS NOT NULL
         GROUP BY location, category HAVING n >= ${MIN_ITEMS}`
      )
      .all(),
    db.prepare('SELECT slug, label FROM categories WHERE active = 1 ORDER BY sort_order').all(),
  ]);
  const labels = new Map(cats.map((c) => [c.slug, c.label]));
  const order = new Map(cats.map((c, i) => [c.slug, i]));
  return rows
    .filter((r) => LOCATIONS.includes(r.location) && labels.has(r.category))
    .map((r) => ({ ...r, label: labels.get(r.category) }))
    .sort((a, b) => LOCATIONS.indexOf(a.location) - LOCATIONS.indexOf(b.location) || order.get(a.category) - order.get(b.category));
}

export function comboUrl(origin, location, category) {
  return `${origin}/location/${encodeURIComponent(location)}/${encodeURIComponent(category)}`;
}

// News pages list newest first (freshness is the point); everything else
// lists by engagement, same as the collections.
export async function locationCategoryItems(db, location, category) {
  const order = category === 'news' ? 'published_at DESC' : `${ENGAGEMENT} DESC, published_at DESC`;
  const { results } = await db
    .prepare(
      `SELECT ${VIDEO_COLUMNS} FROM videos
       WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND location = ? AND category = ?
       ORDER BY ${order} LIMIT ${LIST_LIMIT}`
    )
    .bind(location, category)
    .all();
  return results;
}
