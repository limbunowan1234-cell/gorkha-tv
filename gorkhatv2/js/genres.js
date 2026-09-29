// Canonical list of the 4 Gorkha TV products (replaces the old 6-genre
// GorkhaTV Talkies/Beats/Diaries/Bulletin/Laughs/Flash naming). Single source
// of truth for the frontend (homepage pill row + genre.js's page rendering);
// functions/genre/[slug].js keeps its own small server-side copy (SEO
// strings, category mapping) per this codebase's existing per-file-constant
// convention — keep both in sync by hand if a product/color/label ever
// changes.
//
// CHIMAL absorbs movies/short films/comedy/entertainment/vlogs behind one
// merged feed (kind: 'multi_trending_latest', see genre.js's
// loadMultiTrendingLatest()) — there's no single-category route for it.
// UKAALI (shorts) isn't a `videos.category` at all — content_type='short' is
// a separate dimension with its own existing destination (pages/feed.html,
// see mobileNav.js) — so its entry here is just a themed link, no genre page.
export const GENRES = [
  { slug: 'chimal', categories: ['movies', 'shortfilms', 'comedy', 'entertainment', 'vlogs'], label: 'CHIMAL', color: '#E8A62A', kind: 'multi_trending_latest', href: '/genre/chimal' },
  { slug: 'news', category: 'news', label: 'KHABAR', color: '#3183F2', kind: 'trending_latest', href: '/genre/news' },
  { slug: 'music', category: 'music', label: 'SWARA', color: '#E6479D', kind: 'top10_top100', href: '/genre/music' },
  { slug: 'shorts', category: null, label: 'UKAALI', color: '#2BD19B', kind: 'external', href: '/pages/feed.html' },
];
