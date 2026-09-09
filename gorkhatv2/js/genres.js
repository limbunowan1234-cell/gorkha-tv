// Canonical list of the 6 branded genre destinations (replaces the old
// plain-text genre nav links). Single source of truth for the frontend
// (homepage pill row + genre.js's page rendering); functions/genre/[slug].js
// keeps its own small server-side copy (SEO strings, category mapping) per
// this codebase's existing per-file-constant convention — keep both in sync
// by hand if a genre/color/label ever changes.
//
// Shorts isn't a `videos.category` at all — content_type='short' is a
// separate dimension with its own existing destination (pages/feed.html,
// see mobileNav.js) — so its entry here is just a themed link, no genre page.
export const GENRES = [
  { slug: 'movies', category: 'movies', label: 'GorkhaTV Talkies', color: '#D4A017', kind: 'trending_latest', href: '/genre/movies' },
  { slug: 'music', category: 'music', label: 'GorkhaTV Beats', color: '#E0479E', kind: 'top10_top100', href: '/genre/music' },
  { slug: 'vlogs', category: 'vlogs', label: 'GorkhaTV Diaries', color: '#2EC4B6', kind: 'trending_latest', href: '/genre/vlogs' },
  { slug: 'news', category: 'news', label: 'GorkhaTV Bulletin', color: '#1D7AE0', kind: 'trending_latest', href: '/genre/news' },
  { slug: 'comedy', category: 'comedy', label: 'GorkhaTV Laughs', color: '#FFD23F', kind: 'trending_latest', href: '/genre/comedy' },
  { slug: 'shorts', category: null, label: 'GorkhaTV Flash', color: '#FF9F1C', kind: 'external', href: '/pages/feed.html' },
];
