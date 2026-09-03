import { apiFetch, escapeHtml, videoCardHTML } from './api.js';
import { initAuthNav } from './auth.js';

const LIMIT = 24;
const params = new URLSearchParams(window.location.search);
const preset = window.__PRESET || {};

let state = {
  category: preset.category || params.get('category') || '',
  location: preset.location || params.get('location') || '',
  sort: params.get('sort') || 'latest',
  page: 1,
};

function init() {
  populateFilters();
  wireToolbar();
  updateTitle();
  loadVideos();
  initAuthNav();
}

// News is promoted to its own branded destination rather than a plain
// filtered grid — see functions/category/[cat].js for the matching SEO
// title/description. Khabar Darjeeling is a real, already-approved channel
// (editorial credit, not a content filter — the grid below still shows
// every published news video from every source channel).
function updateTitle() {
  const titleEl = document.getElementById('browse-title');
  const subEl = document.getElementById('browse-subtitle');
  if (!titleEl) return;

  if (state.category === 'news') {
    titleEl.textContent = '📰 Gorkha TV News';
    if (subEl) {
      subEl.innerHTML = 'Powered by <a href="/khabardarjeeling">Khabar Darjeeling</a>';
      subEl.style.display = 'block';
    }
    return;
  }
  if (subEl) subEl.style.display = 'none';

  if (state.category) titleEl.textContent = `${capitalize(state.category)} Videos`;
  else if (state.location) titleEl.textContent = `Videos from ${state.location}`;
  else titleEl.textContent = 'Browse';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function populateFilters() {
  try {
    const [{ categories }, { locations }] = await Promise.all([apiFetch('/categories'), apiFetch('/locations')]);
    const catSelect = document.getElementById('category-select');
    catSelect.insertAdjacentHTML('beforeend', categories.map((c) => `<option value="${c.slug}">${escapeHtml(c.label)}</option>`).join(''));
    catSelect.value = state.category;

    const locSelect = document.getElementById('location-select');
    locSelect.insertAdjacentHTML('beforeend', locations.map((l) => `<option value="${l}">${l}</option>`).join(''));
    locSelect.value = state.location;

    document.getElementById('sort-select').value = state.sort;
  } catch {
    /* filters are optional */
  }
}

function wireToolbar() {
  document.getElementById('category-select').addEventListener('change', (e) => {
    state.category = e.target.value;
    state.page = 1;
    updateTitle();
    loadVideos();
  });
  document.getElementById('location-select').addEventListener('change', (e) => {
    state.location = e.target.value;
    state.page = 1;
    updateTitle();
    loadVideos();
  });
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    loadVideos();
  });
}

async function loadVideos() {
  const grid = document.getElementById('browse-grid');
  grid.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    const qp = new URLSearchParams();
    if (state.category) qp.set('category', state.category);
    if (state.location) qp.set('location', state.location);
    if (state.sort) qp.set('sort', state.sort);
    qp.set('page', state.page);
    qp.set('limit', LIMIT);

    const data = await apiFetch(`/videos?${qp.toString()}`);
    if (!data.videos.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">📭</div><h3>No videos found</h3><p>Try a different category or location.</p></div>`;
    } else {
      grid.innerHTML = data.videos.map(videoCardHTML).join('');
    }

    renderPagination(data.total);
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><h3>Couldn't load videos</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderPagination(total) {
  const el = document.getElementById('browse-pagination');
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  if (totalPages <= 1) {
    el.innerHTML = `${total} video${total === 1 ? '' : 's'}`;
    return;
  }
  el.innerHTML = `
    <button id="prev-page" ${state.page <= 1 ? 'disabled' : ''}>← Prev</button>
    <span>Page ${state.page} of ${totalPages}</span>
    <button id="next-page" ${state.page >= totalPages ? 'disabled' : ''}>Next →</button>
  `;
  document.getElementById('prev-page')?.addEventListener('click', () => {
    state.page -= 1;
    loadVideos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('next-page')?.addEventListener('click', () => {
    state.page += 1;
    loadVideos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

init();
