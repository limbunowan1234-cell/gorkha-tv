import { apiFetch, ytThumb, watchUrl, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';

async function init() {
  await initAuthNav();

  if (!getCurrentUser()) {
    document.getElementById('fav-grid').innerHTML = `
      <div class="empty" style="grid-column:1/-1;">
        <div class="empty-icon">🔒</div>
        <h3>Sign in to see your favourites</h3>
        <p>Use the sign-in button in the top-right to save videos to your list.</p>
      </div>`;
    return;
  }

  loadFavourites();
}

async function loadFavourites() {
  const grid = document.getElementById('fav-grid');
  try {
    const { favourites } = await apiFetch('/favourites');
    if (!favourites.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">🔖</div><h3>No favourites yet</h3><p>Tap "+ My List" on any video to save it here.</p></div>`;
      return;
    }
    grid.innerHTML = favourites.map(favCardHTML).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><h3>Couldn't load favourites</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function favCardHTML(v) {
  return `
    <div class="card" data-id="${v.id}" data-watch-url="${escapeHtml(watchUrl(v))}">
      <div class="card-thumb">
        <img src="${escapeHtml(ytThumb(v))}" alt="${escapeHtml(v.title || '')}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(v.youtube_video_id)}/default.jpg'">
        <div class="card-play-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        ${v.category ? `<span class="card-cat-badge">${escapeHtml(v.category)}</span>` : ''}
        <button class="card-like-btn liked" data-remove="${v.id}" title="Remove from favourites">✕ Remove</button>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(v.title || '')}</div>
        <div class="card-sub">${escapeHtml(v.channel_name || '')}${v.location ? ' · ' + escapeHtml(v.location) : ''}</div>
      </div>
    </div>`;
}

// Single delegated listener handles both "remove" and "navigate to watch
// page" — checking for the remove button first avoids the bubbling-order
// trap of mixing inline onclick handlers on ancestors with a delegated
// listener higher up the tree (an ancestor's onclick fires during bubbling
// before a listener further up ever runs, so stopPropagation() up there is
// too late to prevent it).
document.getElementById('fav-grid').addEventListener('click', async (e) => {
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) {
    const id = removeBtn.dataset.remove;
    try {
      await fetch(`/api/favourites/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      removeBtn.closest('.card').remove();
      showToast('Removed from favourites');
      if (!document.querySelectorAll('#fav-grid .card').length) loadFavourites();
    } catch {
      showToast('Failed to remove — please try again.');
    }
    return;
  }

  const card = e.target.closest('.card');
  if (card) window.location.href = card.dataset.watchUrl;
});

init();
