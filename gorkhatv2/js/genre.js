import { apiFetch, videoCardHTML, numberedCardHTML, escapeHtml, creatorUrl, formatCount, watchUrl } from './api.js';
import { initAuthNav } from './auth.js';
import { GENRES } from './genres.js';
import { setQueue } from './queue.js';
import { navigate } from './router.js';

const LOCATION_EMOJI = { Darjeeling: '🏔️', Kalimpong: '🌄', Kurseong: '🌿', Mirik: '🌸', Siliguri: '🏙️', Sikkim: '🏞️' };
const LOCATIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'Sikkim'];

function init() {
  initAuthNav();

  const injected = window.__GENRE || {};
  const genre = GENRES.find((g) => g.slug === injected.slug) || injected;
  if (!genre.slug) {
    document.getElementById('genre-label').textContent = "Genre not found";
    document.getElementById('genre-primary-section').style.display = 'none';
    document.getElementById('genre-secondary-section').style.display = 'none';
    return;
  }

  applyTheme(genre);
  renderSubnav(genre);

  if (genre.kind === 'top10_top100') loadTop10Top100(genre);
  else if (genre.kind === 'multi_trending_latest') loadMultiTrendingLatest(genre);
  else loadTrendingLatest(genre);
}

// Every accent on the page reads off --red (see genre.html's own comment) —
// retinting it here is enough to theme the whole page in one place.
const DATA_BRAND = { chimal: 'chimal', news: 'khabar', music: 'swara' };

function applyTheme(genre) {
  document.documentElement.style.setProperty('--red', genre.color);
  const brand = DATA_BRAND[genre.slug] || 'gorkhatv';
  document.documentElement.dataset.brand = DATA_BRAND[genre.slug] || '';
  document.documentElement.style.setProperty('--terrace-pattern', `url(/patterns/${brand}-terrace-pattern.svg)`);
  document.getElementById('genre-label').textContent = genre.label;

  const subEl = document.getElementById('genre-sub');
  // GorkhaTV Bulletin is editorially credited to Khabar Darjeeling — links
  // out to their real site (khabardarjeeling.in), not just the internal
  // GorkhaTV profile, same credit shown on /category/news (see browse.js's
  // updateTitle()).
  if (genre.slug === 'news') {
    subEl.innerHTML = 'Breaking news and updates from the Darjeeling hills — powered by <a href="https://www.khabardarjeeling.in/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">Khabar Darjeeling</a>.';
  } else {
    subEl.textContent = genre.tagline || '';
  }
  document.title = `${genre.label} | GorkhaTV`;
}

// CHIMAL's 5 underlying categories, for its subnav's per-category links —
// matches genres.js's GENRES[0].categories exactly.
const CATEGORY_LABEL = { movies: 'Movies', shortfilms: 'Short Films', comedy: 'Comedy', entertainment: 'Entertainment', vlogs: 'Vlogs', magic: 'Magic' };

// Sticky quick-jump menu (genre.html's #genre-subnav) — same-page items
// (data-anchor) scroll to an existing section and get their active state
// tracked by an IntersectionObserver; cross-page items (Top 100, CHIMAL's
// per-category links to the existing /category/:slug browse route) are
// plain links with no active-tracking, since navigating away makes that
// moot. Item set depends on genre.kind, same branching loadTop10Top100()/
// loadMultiTrendingLatest()/loadTrendingLatest() already use.
function renderSubnav(genre) {
  const nav = document.getElementById('genre-subnav');
  if (!nav) return;

  const items = [];
  if (genre.kind === 'top10_top100') {
    items.push({ label: '🎵 Top 10', anchor: '#genre-primary-section' });
    items.push({ label: '💯 Top 100', href: '../pages/chart.html' });
    items.push({ label: '🏆 Top Artists', anchor: '#genre-artists-section' });
    items.push({ label: '🌍 By Region', anchor: '#genre-location-rows' });
  } else {
    items.push({ label: '🔥 Trending', anchor: '#genre-primary-section' });
    items.push({ label: '🆕 Latest', anchor: '#genre-secondary-section' });
    items.push({ label: '🌍 By Region', anchor: '#genre-location-rows' });
    if (genre.kind === 'multi_trending_latest') {
      for (const cat of genre.categories) {
        items.push({ label: CATEGORY_LABEL[cat] || cat, href: `../category/${cat}` });
      }
    }
  }

  nav.innerHTML = items
    .map((it) =>
      it.anchor
        ? `<a href="${it.anchor}" data-anchor="${it.anchor}">${escapeHtml(it.label)}</a>`
        : `<a href="${it.href}">${escapeHtml(it.label)}</a>`
    )
    .join('');

  setupSubnavScrollSpy();
}

// Highlights whichever same-page section is currently in view. rootMargin's
// large negative bottom value means a section only has to clear the sticky
// nav+subnav header (their combined ~110px height) to count as "current" —
// without it, a short section (e.g. Top Artists) could satisfy the default
// 100%-visible threshold at the same time as its neighbor, fighting for
// which link lights up.
function setupSubnavScrollSpy() {
  const links = [...document.querySelectorAll('#genre-subnav a[data-anchor]')];
  if (!links.length) return;
  const sections = links.map((link) => ({ link, el: document.querySelector(link.dataset.anchor) })).filter((s) => s.el);
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const match = sections.find((s) => s.el === entry.target);
        if (match) {
          links.forEach((l) => l.classList.remove('active'));
          match.link.classList.add('active');
        }
      }
    },
    { rootMargin: '-110px 0px -70% 0px' }
  );
  sections.forEach((s) => observer.observe(s.el));
  links[0].classList.add('active'); // sensible default before any scroll/intersection fires
}

// Region-wise Top 10s, within this genre only — every genre page gets these
// (including music, below its Top10->Top100 flow), same ROW_NUMBER() ranking
// as the homepage's own location rows, just category-scoped.
function renderLocationRows(genre, byLocation) {
  const wrap = document.getElementById('genre-location-rows');
  if (!wrap) return;
  // CHIMAL spans several categories (genre.categories, no single genre.category)
  // — there's no one-category "see all" link that fits, so its rows link to
  // an unfiltered location browse instead of a category-scoped one.
  const seeAllQuery = genre.category ? `category=${encodeURIComponent(genre.category)}&location=` : 'location=';
  const rows = LOCATIONS.filter((loc) => (byLocation[loc] || []).length).map((loc) => ({
    loc,
    title: `${LOCATION_EMOJI[loc] || ''} Top 10 ${loc}`,
    link: `../pages/browse.html?${seeAllQuery}${encodeURIComponent(loc)}`,
    items: byLocation[loc],
  }));
  wrap.innerHTML = rows
    .map(
      (row, i) => `
    <div class="row">
      <div class="row-header">
        <h2 class="row-title">${escapeHtml(row.title)}</h2>
        <a href="${row.link}" class="see-all">See all →</a>
      </div>
      <div class="cards-scroll" id="genre-loc-row-${i}"></div>
    </div>`
    )
    .join('');
  rows.forEach((row, i) => {
    document.getElementById(`genre-loc-row-${i}`).innerHTML = row.items.map((v, idx) => numberedCardHTML(v, idx + 1)).join('');
  });
}

async function loadTrendingLatest(genre) {
  const primaryTitle = document.getElementById('genre-primary-title');
  const primaryRow = document.getElementById('genre-primary-row');
  const primarySection = document.getElementById('genre-primary-section');
  const secondaryTitle = document.getElementById('genre-secondary-title');
  const secondaryRow = document.getElementById('genre-secondary-row');

  primaryTitle.textContent = `🔥 Trending in ${genre.label}`;
  secondaryTitle.textContent = `🆕 Latest ${genre.label}`;

  try {
    const { trending, latest, byLocation } = await apiFetch(`/genre/${genre.category}`);

    if (trending && trending.length) {
      primarySection.style.display = '';
      primaryRow.innerHTML = trending.map(videoCardHTML).join('');
    } else {
      primarySection.style.display = 'none';
    }

    if (latest && latest.length) {
      secondaryRow.innerHTML = latest.map(videoCardHTML).join('');
    } else {
      secondaryRow.innerHTML = `<div class="genre-empty">No videos here yet — check back soon.</div>`;
    }

    renderLocationRows(genre, byLocation || {});
  } catch (err) {
    primarySection.style.display = 'none';
    secondaryRow.innerHTML = `<div class="genre-empty">Couldn't load this genre right now — please try again shortly.</div>`;
  }
}

// CHIMAL — merges several single-category /api/genre/:category responses
// client-side into one feed (no dedicated multi-category API route exists;
// each category's own route stays untouched and is still used directly by
// KHABAR/SWARA). Trending merges by trend_score, latest by published_at,
// byLocation unions per region then re-sorts by the same engagement signal
// the single-category route already ranks by — mirrors the merge approach
// the CHIMAL mobile app's own FeedScreen uses.
async function loadMultiTrendingLatest(genre) {
  const primaryTitle = document.getElementById('genre-primary-title');
  const primaryRow = document.getElementById('genre-primary-row');
  const primarySection = document.getElementById('genre-primary-section');
  const secondaryTitle = document.getElementById('genre-secondary-title');
  const secondaryRow = document.getElementById('genre-secondary-row');

  primaryTitle.textContent = `🔥 Trending on ${genre.label}`;
  secondaryTitle.textContent = `🆕 Latest on ${genre.label}`;

  try {
    const results = await Promise.all(genre.categories.map((cat) => apiFetch(`/genre/${cat}`).catch(() => ({ trending: [], latest: [], byLocation: {} }))));

    const trending = results.flatMap((r) => r.trending || []).sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0)).slice(0, 20);
    const latest = results.flatMap((r) => r.latest || []).sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 20);

    if (trending.length) {
      primarySection.style.display = '';
      primaryRow.innerHTML = trending.map(videoCardHTML).join('');
    } else {
      primarySection.style.display = 'none';
    }

    if (latest.length) {
      secondaryRow.innerHTML = latest.map(videoCardHTML).join('');
    } else {
      secondaryRow.innerHTML = `<div class="genre-empty">No videos here yet — check back soon.</div>`;
    }

    const byLocation = {};
    for (const r of results) {
      for (const [loc, items] of Object.entries(r.byLocation || {})) {
        (byLocation[loc] ||= []).push(...items);
      }
    }
    for (const loc of Object.keys(byLocation)) {
      byLocation[loc] = byLocation[loc]
        .sort((a, b) => (b.view_count + (b.like_count || 0) * 10) - (a.view_count + (a.like_count || 0) * 10) || new Date(b.published_at) - new Date(a.published_at))
        .slice(0, 10);
    }
    renderLocationRows(genre, byLocation);
  } catch (err) {
    primarySection.style.display = 'none';
    secondaryRow.innerHTML = `<div class="genre-empty">Couldn't load this section right now — please try again shortly.</div>`;
  }
}

// Music ("SWARA") — a themed Top 10 preview instead of Trending/
// Latest, with a "See All 100" CTA pointing at the full ranked chart
// (pages/chart.html, already built) rather than duplicating that list here.
async function loadTop10Top100(genre) {
  document.getElementById('genre-primary-title').textContent = `🎵 Top 10 This Week — ${genre.label}`;
  document.getElementById('genre-secondary-section').style.display = 'none';
  document.getElementById('genre-cta-wrap').style.display = '';

  const primaryRow = document.getElementById('genre-primary-row');
  try {
    const { chart } = await apiFetch('/chart');
    if (!chart.length) {
      primaryRow.innerHTML = `<div class="genre-empty">No chart data yet — check back once more music has synced.</div>`;
    } else {
      primaryRow.innerHTML = chart.slice(0, 10).map((v, i) => numberedCardHTML(v, i + 1)).join('');
      // Queue-seed from the FULL Top 100, not just the 10 rendered cards —
      // a listener starting here still gets the whole chart behind them,
      // same as starting from /pages/chart.html itself. numberedCardHTML
      // is shared with non-Beats homepage rows (api.js) so it's left
      // untouched — this click handler is scoped to this one container and
      // intercepts navigation itself (preventDefault + explicit
      // ?autoplay=1) rather than changing the shared card markup.
      primaryRow.addEventListener('click', (e) => {
        const card = e.target.closest('.num-card');
        if (!card) return;
        const index = [...primaryRow.children].indexOf(card);
        if (index === -1) return;
        e.preventDefault();
        setQueue(chart, index);
        // /genre/music is a router-participating page — this goes
        // through it (fetch+swap, keeps the player bar alive) rather than a
        // real navigation; router.js's own transitionTo() already falls
        // back to a real navigation on its own if anything about the
        // destination page looks wrong, so this is safe on every genre.
        navigate(watchUrl(chart[index], { autoplay: true }));
      });
    }
  } catch (err) {
    primaryRow.innerHTML = `<div class="genre-empty">Couldn't load the chart right now — please try again shortly.</div>`;
  }

  loadTopArtists();

  // Region rows aren't in /chart's response (it's an all-region Top 100),
  // so this is a second, small request — same /genre/:category route every
  // other genre page uses, just ignoring its trending/latest fields here.
  try {
    const { byLocation } = await apiFetch(`/genre/${genre.category}`);
    renderLocationRows(genre, byLocation || {});
  } catch (err) {
    // Region rows are a bonus on this page (the Top 10/Top 100 above is the
    // main content) — fail silently rather than showing a second error.
  }
}

// Top 20 Artists — ranked by total engagement across each artist's whole
// music catalog (see /api/top-artists), not just their single best song.
async function loadTopArtists() {
  const section = document.getElementById('genre-artists-section');
  const list = document.getElementById('genre-artists-list');
  try {
    const { artists } = await apiFetch('/top-artists');
    if (!artists || !artists.length) return; // stays hidden — nothing to show yet
    section.style.display = '';
    list.innerHTML = artists.map((a, i) => artistRowHTML(a, i + 1)).join('');
  } catch (err) {
    // Bonus section, same as the region rows below — fail silently.
  }
}

function artistRowHTML(a, rank) {
  const stats = [`${formatCount(a.video_count)} songs`, a.total_engagement ? `${formatCount(a.total_engagement)} engagement` : null]
    .filter(Boolean)
    .join(' · ');
  return `
    <a class="artist-row" href="${creatorUrl(a)}">
      <div class="artist-rank">${rank}</div>
      <img class="artist-avatar" src="${escapeHtml(a.thumbnail_url || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="artist-info">
        <div class="artist-name">${escapeHtml(a.channel_name || '')}</div>
        <div class="artist-stats">${escapeHtml(stats)}</div>
      </div>
    </a>`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
