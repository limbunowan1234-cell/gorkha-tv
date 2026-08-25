import { apiFetch, ytThumb, watchUrl, creatorUrl, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';

async function init() {
  await initAuthNav();

  if (!getCurrentUser()) {
    const lockedHtml = `
      <div class="empty" style="grid-column:1/-1;">
        <div class="empty-icon">🔒</div>
        <h3>Sign in to see this</h3>
        <p>Use the sign-in button in the top-right.</p>
      </div>`;
    document.getElementById('fav-grid').innerHTML = lockedHtml;
    document.getElementById('following-grid').innerHTML = lockedHtml;
    return;
  }

  loadFavourites();
  loadFollowing();
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

async function loadFollowing() {
  const grid = document.getElementById('following-grid');
  try {
    const { follows } = await apiFetch('/follows');
    if (!follows.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">👥</div><h3>Not following anyone yet</h3><p>Tap "Follow" on any creator's page to see them here.</p></div>`;
      return;
    }
    grid.innerHTML = follows.map(followCardHTML).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><h3>Couldn't load following</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function followCardHTML(c) {
  return `
    <div class="card" data-id="${c.id}" data-creator-url="${escapeHtml(creatorUrl(c))}">
      <div class="card-thumb" style="background:var(--surface2);">
        ${c.thumbnail_url ? `<img src="${escapeHtml(c.thumbnail_url)}" alt="${escapeHtml(c.channel_name)}" loading="lazy">` : ''}
        <button class="card-like-btn liked" data-unfollow="${c.id}" title="Unfollow">✕ Unfollow</button>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(c.channel_name || '')}${c.verified ? ' <span class="verified-tick" title="Verified">✓</span>' : ''}</div>
        <div class="card-sub">${escapeHtml(c.category || '')}${c.location ? ' · ' + escapeHtml(c.location) : ''}</div>
      </div>
    </div>`;
}

document.getElementById('following-grid').addEventListener('click', async (e) => {
  const unfollowBtn = e.target.closest('[data-unfollow]');
  if (unfollowBtn) {
    const id = unfollowBtn.dataset.unfollow;
    try {
      await fetch(`/api/follows/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      unfollowBtn.closest('.card').remove();
      showToast('Unfollowed');
      if (!document.querySelectorAll('#following-grid .card').length) loadFollowing();
    } catch {
      showToast('Failed to unfollow — please try again.');
    }
    return;
  }

  const card = e.target.closest('.card');
  if (card) window.location.href = card.dataset.creatorUrl;
});

init();
