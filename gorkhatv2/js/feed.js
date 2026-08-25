// Instagram-Home-style continuously-scrollable feed of Shorts — a second
// browsing mode for the exact same content/data as templates/shorts.html
// (same /api/shorts personalized ranking, same /api/shorts/event signal),
// just laid out as normal-scroll cards instead of a full-screen swipe.
// Player lifecycle (preload-next-1/destroy-2-away) and dwell-tracking mirror
// shorts.js's structure deliberately — see Phase G plan notes on why this
// isn't extracted into one shared module with shorts.js: the DOM/CSS shape
// (compact card vs. full-bleed slide) differs enough that forcing it would
// add more indirection than it saves for a second instance.
import { apiFetch, ytThumb, creatorUrl, formatCount, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';
import { initCommentsDrawer, openComments } from './commentsDrawer.js';
import { loadYouTubeApi } from './youtubeApi.js';

const feedEl = document.getElementById('feed-wrap');

const items = [];
const cardEls = [];
const players = new Map(); // index -> YT.Player
let currentIndex = -1;
let isMuted = true;
let nextCursor = null;
let loadingMore = false;
let exhausted = false;
let favouriteIds = new Set();
let observer = null;
let activatedAt = null;

init();

async function init() {
  await initAuthNav();
  initCommentsDrawer();
  loadFavouriteState();

  try {
    const { shorts, nextCursor: nc } = await apiFetch('/shorts?limit=10');
    appendItems(shorts);
    nextCursor = nc;
  } catch {
    renderEmpty();
    return;
  }

  if (!items.length) {
    renderEmpty();
    return;
  }

  feedEl.querySelector('.feed-loading')?.remove();
  setupObserver();
}

async function loadFavouriteState() {
  if (!getCurrentUser()) return;
  try {
    const { favourites } = await apiFetch('/favourites');
    favouriteIds = new Set(favourites.map((f) => f.id));
  } catch {
    /* nice-to-have */
  }
}

function renderEmpty() {
  feedEl.innerHTML = `<div class="feed-empty"><div style="font-size:32px;">🎬</div><div>No Shorts yet — check back soon.</div></div>`;
}

function appendItems(newItems) {
  for (const item of newItems) {
    const index = items.length;
    items.push(item);
    const el = renderCard(item, index);
    cardEls.push(el);
    feedEl.appendChild(el);
    if (observer) observer.observe(el.querySelector('.feed-media-wrap'));
  }
}

function renderCard(item, index) {
  const el = document.createElement('div');
  el.className = 'feed-card';
  el.dataset.index = String(index);

  const poster = ytThumb(item);
  const isLiked = favouriteIds.has(item.id);

  el.innerHTML = `
    <div class="feed-card-header" data-action="open-creator">
      <div class="feed-card-avatar" style="display:flex;align-items:center;justify-content:center;font-size:16px;">📺</div>
      <div>
        <div class="feed-card-creator">${escapeHtml(item.channel_name || 'Unknown creator')}</div>
        ${item.location ? `<div class="feed-card-location">📍 ${escapeHtml(item.location)}</div>` : ''}
      </div>
    </div>
    <div class="feed-media-wrap" data-index="${index}">
      <div class="feed-poster" style="background-image:url('${escapeHtml(poster)}')"></div>
      <div class="feed-player-frame" id="feed-player-${index}"></div>
      <div class="feed-tap-catcher" data-action="tap-catcher" title="Tap to open · double-tap to like"></div>
      <button class="feed-mute-btn" data-action="mute-toggle" data-mute-icon aria-label="Toggle sound">🔇</button>
    </div>
    <div class="feed-actions-row">
      <button class="feed-action-btn ${isLiked ? 'liked' : ''}" data-action="like">
        <span data-like-icon>${isLiked ? '❤️' : '🤍'}</span>
        <span class="feed-action-count" data-like-count>${item.like_count ? formatCount(item.like_count) : ''}</span>
      </button>
      <button class="feed-action-btn" data-action="comments">💬</button>
      <button class="feed-action-btn" data-action="share">↗</button>
      <a class="feed-action-btn feed-save-btn" href="https://www.youtube.com/watch?v=${encodeURIComponent(item.youtube_video_id)}" target="_blank" rel="noopener">▶</a>
    </div>
    <div class="feed-caption"><span class="creator">${escapeHtml(item.channel_name || '')}</span>${escapeHtml(item.title || '')}</div>
    ${item.location || item.published_at ? `<div class="feed-meta">${[item.location, item.published_at ? new Date(item.published_at).toLocaleDateString() : null].filter(Boolean).join(' · ')}</div>` : ''}
  `;

  el.querySelector('[data-action="tap-catcher"]').addEventListener('click', (e) => handleTapCatcherTap(e, el, item));
  el.querySelector('[data-action="mute-toggle"]').addEventListener('click', () => toggleMute(el));
  el.querySelector('[data-action="open-creator"]').addEventListener('click', () => {
    window.location.href = creatorUrl({ youtube_channel_id: item.youtube_channel_id });
  });
  el.querySelector('[data-action="like"]').addEventListener('click', (e) => toggleLike(item, e.currentTarget));
  el.querySelector('[data-action="comments"]').addEventListener('click', () => openComments(item));
  el.querySelector('[data-action="share"]').addEventListener('click', () => shareItem(item));

  return el;
}

const TAP_DELAY_MS = 250;
const tapState = new WeakMap();

function handleTapCatcherTap(e, cardEl, item) {
  const mediaWrap = cardEl.querySelector('.feed-media-wrap');
  const state = tapState.get(cardEl) || { count: 0, timer: null };
  state.count += 1;

  if (state.count === 1) {
    // A plain tap opens the immersive full-screen swipe view at this exact
    // video — reuses the /shorts/:id deep link built for Phase F, so no new
    // routing/backend is needed here. Held for TAP_DELAY_MS in case a second
    // tap follows (double-tap-to-like takes priority over navigating away).
    state.timer = setTimeout(() => {
      window.location.href = `/shorts/${item.youtube_video_id}`;
      state.count = 0;
    }, TAP_DELAY_MS);
  } else {
    clearTimeout(state.timer);
    state.count = 0;
    likeWithHeartBurst(item, cardEl, mediaWrap, e);
  }
  tapState.set(cardEl, state);
}

async function likeWithHeartBurst(item, cardEl, mediaWrap, e) {
  const rect = mediaWrap.getBoundingClientRect();
  spawnHeartBurst(mediaWrap, e.clientX - rect.left, e.clientY - rect.top);

  if (favouriteIds.has(item.id)) return;
  const btn = cardEl.querySelector('[data-action="like"]');
  await toggleLike(item, btn);
}

function spawnHeartBurst(mediaWrap, x, y) {
  const el = document.createElement('div');
  el.className = 'feed-heart-burst burst';
  el.textContent = '❤️';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  mediaWrap.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function toggleMute(cardEl) {
  const index = Number(cardEl.dataset.index);
  const player = players.get(index);
  if (!player) return;
  isMuted = !isMuted;
  try {
    if (isMuted) player.mute();
    else player.unMute();
  } catch {
    return;
  }
  // A persistent icon-button rather than shorts.js's transient flash — the
  // tap that used to toggle mute now navigates away instead (see
  // handleTapCatcherTap), so this dedicated button is the only mute control
  // in the Feed and needs to keep showing the current state, not fade out.
  cardEl.querySelector('[data-mute-icon]').textContent = isMuted ? '🔇' : '🔊';
}

async function toggleLike(item, btn) {
  if (!getCurrentUser()) {
    showToast('Sign in to save Shorts');
    return;
  }
  const isLiked = favouriteIds.has(item.id);
  const icon = btn.querySelector('[data-like-icon]');
  try {
    if (isLiked) {
      await fetch(`/api/favourites/${encodeURIComponent(item.id)}`, { method: 'DELETE', credentials: 'include' });
      favouriteIds.delete(item.id);
      icon.textContent = '🤍';
      btn.classList.remove('liked');
      showToast('Removed from favourites');
    } else {
      await fetch('/api/favourites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoId: item.id }),
      });
      favouriteIds.add(item.id);
      icon.textContent = '❤️';
      btn.classList.add('liked');
      showToast('Added to favourites 🔖');
      postShortsEvent(item, 'liked');
    }
  } catch {
    showToast('Something went wrong — please try again.');
  }
}

function postShortsEvent(item, eventType) {
  const payload = JSON.stringify({
    youtubeVideoId: item.youtube_video_id,
    category: item.category,
    channelId: item.youtube_channel_id,
    eventType,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/shorts/event', new Blob([payload], { type: 'application/json' }));
  } else {
    fetch('/api/shorts/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  }
}

function recordDwellEvent(index) {
  if (index < 0 || activatedAt == null) return;
  const item = items[index];
  if (!item) return;
  const dwellSeconds = (Date.now() - activatedAt) / 1000;
  const duration = item.duration_seconds;
  const watchedFullThreshold = duration ? duration * 0.8 : 8;
  if (dwellSeconds < 3) postShortsEvent(item, 'skipped');
  else if (dwellSeconds >= watchedFullThreshold) postShortsEvent(item, 'watched_full');
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') recordDwellEvent(currentIndex);
});

async function shareItem(item) {
  // Shares the canonical per-video URL (the full-screen Shorts page, which
  // has real SSR meta tags) rather than a feed-specific link — the Feed page
  // has no per-item route of its own, and one canonical URL per video is
  // correct regardless of which browsing UI a viewer found it through.
  const url = `${window.location.origin}/shorts/${item.youtube_video_id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, url });
    } catch {
      /* cancelled — not an error */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard');
  } catch {
    showToast(url);
  }
}


async function ensurePlayer(index) {
  if (index < 0 || index >= items.length) return;
  if (players.has(index)) return;
  const YT = await loadYouTubeApi();
  if (players.has(index) || index >= items.length) return;
  const item = items[index];
  const player = new YT.Player(`feed-player-${index}`, {
    videoId: item.youtube_video_id,
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 1,
      rel: 0,
      fs: 0,
      playsinline: 1,
      loop: 1,
      playlist: item.youtube_video_id,
    },
    events: {
      onReady: (e) => {
        if (isMuted) e.target.mute();
        else e.target.unMute();
        if (index === currentIndex) e.target.playVideo();
        else e.target.pauseVideo();
      },
    },
  });
  players.set(index, player);
}

function destroyFarPlayers(centerIndex) {
  for (const [index, player] of players.entries()) {
    if (Math.abs(index - centerIndex) > 1) {
      try {
        player.destroy();
      } catch {
        /* already torn down */
      }
      players.delete(index);
    }
  }
}

function setActive(index) {
  if (index === currentIndex || index < 0 || index >= items.length) return;
  recordDwellEvent(currentIndex);
  currentIndex = index;
  activatedAt = Date.now();

  ensurePlayer(index).then(() => {
    if (index !== currentIndex) return;
    try {
      players.get(index)?.playVideo();
    } catch {
      /* onReady will start it once it fires */
    }
  });
  ensurePlayer(index + 1);

  for (const [i, player] of players.entries()) {
    if (i !== index) {
      try {
        player.pauseVideo();
      } catch {
        /* not ready yet */
      }
    }
  }

  destroyFarPlayers(index);

  if (index >= items.length - 3 && !loadingMore && !exhausted) fetchMore();
}

async function fetchMore() {
  if (loadingMore || exhausted || !nextCursor) {
    if (!nextCursor && !loadingMore) exhausted = true;
    return;
  }
  loadingMore = true;
  try {
    const { shorts, nextCursor: nc } = await apiFetch(`/shorts?cursor=${encodeURIComponent(nextCursor)}&limit=10`);
    if (!shorts.length) {
      exhausted = true;
      appendEndMarker();
    } else {
      appendItems(shorts);
      nextCursor = nc;
      if (!nc) exhausted = true;
    }
  } catch {
    /* transient — retried on the next scroll-triggered check */
  } finally {
    loadingMore = false;
  }
}

function appendEndMarker() {
  if (feedEl.querySelector('.feed-end')) return;
  const el = document.createElement('div');
  el.className = 'feed-end';
  el.innerHTML = `<div style="font-size:28px;">🏔️</div><div>You're all caught up</div>`;
  feedEl.appendChild(el);
}

// Unlike shorts.js's snap-locked single-active-slide model, several cards
// can be partially visible at once here — same "whichever crosses the
// visibility threshold with the highest ratio wins" rule from shorts.js
// still picks exactly one active card, it just now runs against normal
// scroll instead of scroll-snap positions.
function setupObserver() {
  observer = new IntersectionObserver(
    (entries) => {
      let best = null;
      for (const entry of entries) {
        if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
          best = entry;
        }
      }
      if (best && best.intersectionRatio > 0.5) {
        setActive(Number(best.target.dataset.index));
      } else {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            const player = players.get(idx);
            if (player && idx !== currentIndex) {
              try {
                player.pauseVideo();
              } catch {
                /* not ready yet */
              }
            }
          }
        }
      }
    },
    { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
  );
  cardEls.forEach((el) => observer.observe(el.querySelector('.feed-media-wrap')));
}
