import { apiFetch, ytThumb, watchUrl, creatorUrl, formatViews, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/\/watch\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function init() {
  await initAuthNav();

  const id = getVideoIdFromPath();
  if (!id) return renderNotFound();

  try {
    const { video } = await apiFetch(`/videos/${encodeURIComponent(id)}`);
    renderVideo(video);
    initFavouriteButton(video);
    loadRelated(id);
    recordView(id);
  } catch (err) {
    renderNotFound();
  }
}

// Real on-site view signal for the homepage Trending row (functions/api/home.js)
// — fired only once the watch page has actually rendered in a real browser,
// not from the SSR route, so bots/crawlers/link previews don't inflate it.
// Fire-and-forget: never blocks the page, never surfaces an error to the viewer.
function recordView(id) {
  fetch(`/api/videos/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
}

function renderVideo(v) {
  document.title = `${v.title} | GorkhaTV`;

  const player = document.getElementById('watch-player');
  player.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(v.youtube_video_id)}" title="${escapeHtml(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

  document.getElementById('watch-title').textContent = v.title || '';

  const meta = [];
  if (v.published_at) meta.push(`<span>${new Date(v.published_at).toLocaleDateString()}</span>`);
  if (v.category) meta.push(`<div class="dot"></div><span>${escapeHtml(v.category)}</span>`);
  if (v.location) meta.push(`<div class="dot"></div><span>${escapeHtml(v.location)}</span>`);
  if (v.view_count) meta.push(`<div class="dot"></div><span>${escapeHtml(formatViews(v.view_count))}</span>`);
  document.getElementById('watch-meta').innerHTML = meta.join('');

  if (v.channel_name) {
    const channelEl = document.getElementById('watch-channel');
    channelEl.style.display = 'flex';
    document.getElementById('watch-channel-name').textContent = v.channel_name;
    document.getElementById('watch-channel-sub').textContent = v.channel_handle || '';
    const img = document.getElementById('watch-channel-img');
    img.src = ytThumb(v);
    img.onerror = () => (img.style.display = 'none');
    channelEl.onclick = (e) => {
      if (e.target.closest('.watch-actions')) return;
      window.location.href = creatorUrl({ youtube_channel_id: v.youtube_channel_id });
    };
    channelEl.style.cursor = 'pointer';
  }

  document.getElementById('watch-yt-link').href = `https://www.youtube.com/watch?v=${encodeURIComponent(v.youtube_video_id)}`;
  document.getElementById('watch-desc').textContent = v.description || '';
}

async function initFavouriteButton(v) {
  const btn = document.getElementById('watch-fav-btn');
  if (!btn) return;

  if (!getCurrentUser()) {
    btn.onclick = () => showToast('Sign in to save favourites');
    return;
  }

  let isFavourited = false;
  try {
    const { favourites } = await apiFetch('/favourites');
    isFavourited = favourites.some((f) => f.id === v.id);
  } catch {
    /* favourite state is a nice-to-have — button still works without it */
  }
  setFavouriteButtonState(btn, isFavourited);

  btn.onclick = async () => {
    try {
      if (isFavourited) {
        await fetch(`/api/favourites/${encodeURIComponent(v.id)}`, { method: 'DELETE', credentials: 'include' });
        isFavourited = false;
        showToast('Removed from favourites');
      } else {
        await fetch('/api/favourites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ videoId: v.id }),
        });
        isFavourited = true;
        showToast('Added to favourites 🔖');
      }
      setFavouriteButtonState(btn, isFavourited);
    } catch {
      showToast('Something went wrong — please try again.');
    }
  };
}

function setFavouriteButtonState(btn, isFavourited) {
  btn.textContent = isFavourited ? '🔖 Saved' : '+ My List';
  btn.classList.toggle('saved', isFavourited);
}

async function loadRelated(id) {
  const el = document.getElementById('related-list');
  try {
    const { related } = await apiFetch(`/videos/${encodeURIComponent(id)}/related`);
    if (!related.length) {
      el.innerHTML = `<div style="color:var(--muted);font-size:13px;">No related videos yet.</div>`;
      return;
    }
    el.innerHTML = related
      .map(
        (r) => `
      <div class="related-item" onclick="window.location.href='${watchUrl(r)}'">
        <div class="related-thumb"><img src="${escapeHtml(ytThumb(r))}" loading="lazy" alt="" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(r.youtube_video_id)}/default.jpg'"></div>
        <div>
          <div class="related-title">${escapeHtml(r.title)}</div>
          <div class="related-sub">${escapeHtml(r.channel_name || '')}</div>
        </div>
      </div>`
      )
      .join('');
  } catch {
    el.innerHTML = '';
  }
}

function renderNotFound() {
  document.getElementById('watch-title').textContent = 'Video not found';
  document.getElementById('watch-desc').textContent = 'This video may have been removed, or the link is incorrect.';
  document.getElementById('watch-player').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);">Unavailable</div>`;
  document.getElementById('related-list').innerHTML = '';
}

init();
