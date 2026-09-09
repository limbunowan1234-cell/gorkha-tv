import { apiFetch, videoCardHTML, numberedCardHTML, escapeHtml } from './api.js';
import { initAuthNav } from './auth.js';
import { GENRES } from './genres.js';

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

  if (genre.kind === 'top10_top100') loadTop10Top100(genre);
  else loadTrendingLatest(genre);
}

// Every accent on the page reads off --red (see genre.html's own comment) —
// retinting it here is enough to theme the whole page in one place.
function applyTheme(genre) {
  document.documentElement.style.setProperty('--red', genre.color);
  document.getElementById('genre-label').textContent = genre.label;

  const subEl = document.getElementById('genre-sub');
  // GorkhaTV Bulletin is editorially credited to Khabar Darjeeling (a real,
  // already-approved channel — /khabardarjeeling) — same credit already
  // shown on /category/news (see browse.js's updateTitle()), just linked
  // here too instead of left as plain text.
  if (genre.slug === 'news') {
    subEl.innerHTML = 'Breaking news and updates from the Darjeeling hills — powered by <a href="/khabardarjeeling" style="color:inherit;text-decoration:underline;">Khabar Darjeeling</a>.';
  } else {
    subEl.textContent = genre.tagline || '';
  }
  document.title = `${genre.label} | GorkhaTV`;
}

// Region-wise Top 10s, within this genre only — every genre page gets these
// (including music, below its Top10->Top100 flow), same ROW_NUMBER() ranking
// as the homepage's own location rows, just category-scoped.
function renderLocationRows(genre, byLocation) {
  const wrap = document.getElementById('genre-location-rows');
  if (!wrap) return;
  const rows = LOCATIONS.filter((loc) => (byLocation[loc] || []).length).map((loc) => ({
    loc,
    title: `${LOCATION_EMOJI[loc] || ''} Top 10 ${loc}`,
    link: `../pages/browse.html?category=${encodeURIComponent(genre.category)}&location=${encodeURIComponent(loc)}`,
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

// Music ("GorkhaTV Beats") — a themed Top 10 preview instead of Trending/
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
    }
  } catch (err) {
    primaryRow.innerHTML = `<div class="genre-empty">Couldn't load the chart right now — please try again shortly.</div>`;
  }

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
