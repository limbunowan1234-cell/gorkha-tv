import { apiFetch, escapeHtml, videoCardHTML, creatorUrl } from './api.js';
import { initAuthNav } from './auth.js';

initAuthNav();

const input = document.getElementById('search-input');
const resultsEl = document.getElementById('search-results');
let debounceTimer;

const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
if (initialQuery) {
  input.value = initialQuery;
  runSearch(initialQuery);
}

input.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  const q = e.target.value.trim();
  history.replaceState(null, '', q ? `?q=${encodeURIComponent(q)}` : window.location.pathname);
  debounceTimer = setTimeout(() => runSearch(q), 300);
});

async function runSearch(q) {
  if (!q) {
    resultsEl.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><h3>Search GorkhaTV</h3><p>Try "Darjeeling food", a creator name, or a category.</p></div>`;
    return;
  }

  resultsEl.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    const { videos, creators } = await apiFetch(`/search?q=${encodeURIComponent(q)}`);

    if (!videos.length && !creators.length) {
      resultsEl.innerHTML = `<div class="empty"><div class="empty-icon">😕</div><h3>No results for "${escapeHtml(q)}"</h3><p>Try a different search term.</p></div>`;
      return;
    }

    let html = '';
    if (creators.length) {
      html += `<div class="search-section-title">Creators <span class="count">${creators.length}</span></div>`;
      html += `<div class="creator-mini-row">${creators.map(creatorMiniHTML).join('')}</div>`;
    }
    if (videos.length) {
      html += `<div class="search-section-title">Videos <span class="count">${videos.length}</span></div>`;
      html += `<div class="search-grid">${videos.map(videoCardHTML).join('')}</div>`;
    }
    resultsEl.innerHTML = html;
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>Search failed</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function creatorMiniHTML(c) {
  return `
    <div class="creator-mini" onclick="window.location.href='${creatorUrl(c)}'">
      ${c.thumbnail_url ? `<img src="${escapeHtml(c.thumbnail_url)}" alt="${escapeHtml(c.channel_name)}" loading="lazy">` : `<div style="width:64px;height:64px;border-radius:50%;background:var(--surface2);margin:0 auto 8px;"></div>`}
      <div class="name">${escapeHtml(c.channel_name)}</div>
    </div>`;
}
