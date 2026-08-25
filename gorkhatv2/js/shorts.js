import { apiFetch, ytThumb, creatorUrl, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';

const feedEl = document.getElementById('shorts-feed');

const items = [];       // video metadata, index-aligned with slideEls
const slideEls = [];    // rendered <div class="shorts-slide">
const players = new Map(); // index -> YT.Player
let currentIndex = -1;
let isMuted = true;      // starts muted (autoplay policy); once the viewer unmutes once, stays unmuted for the session
let nextCursor = null;
let loadingMore = false;
let exhausted = false;
let favouriteIds = new Set(); // internal video ids the signed-in viewer already saved
let observer = null;
let activatedAt = null; // Date.now() when the current slide became active — dwell time is measured from here

init();

async function init() {
  await initAuthNav();
  loadFavouriteState();

  const deepLinkId = getShortIdFromPath();
  try {
    if (deepLinkId) {
      const { video } = await apiFetch(`/videos/${encodeURIComponent(deepLinkId)}`);
      appendItems([video]);
      const more = await apiFetch(`/shorts?exclude=${encodeURIComponent(deepLinkId)}&limit=10`);
      appendItems(more.shorts);
      nextCursor = more.nextCursor;
    } else {
      const { shorts, nextCursor: nc } = await apiFetch('/shorts?limit=10');
      appendItems(shorts);
      nextCursor = nc;
    }
  } catch (err) {
    renderEmpty();
    return;
  }

  if (!items.length) {
    renderEmpty();
    return;
  }

  feedEl.querySelector('.shorts-loading')?.remove();
  setupObserver();
  setActive(0);
}

function getShortIdFromPath() {
  const match = window.location.pathname.match(/\/shorts\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function loadFavouriteState() {
  if (!getCurrentUser()) return;
  try {
    const { favourites } = await apiFetch('/favourites');
    favouriteIds = new Set(favourites.map((f) => f.id));
  } catch {
    /* favourite state is a nice-to-have on this feed too */
  }
}

function renderEmpty() {
  feedEl.innerHTML = `<div class="shorts-empty"><div style="font-size:32px;">🎬</div><div>No Shorts yet — check back soon.</div></div>`;
}

function appendItems(newItems) {
  for (const item of newItems) {
    const index = items.length;
    items.push(item);
    const el = renderSlide(item, index);
    slideEls.push(el);
    feedEl.appendChild(el);
    if (observer) observer.observe(el);
  }
}

function renderSlide(item, index) {
  const el = document.createElement('div');
  el.className = 'shorts-slide';
  el.dataset.index = String(index);

  const poster = ytThumb(item);
  const isLiked = favouriteIds.has(item.id);

  el.innerHTML = `
    <div class="shorts-poster" style="background-image:url('${escapeHtml(poster)}')"></div>
    <div class="shorts-player-frame" id="yt-player-${index}"></div>
    <div class="shorts-tap-catcher" data-action="tap-catcher"></div>
    <div class="shorts-mute-flash" data-mute-flash>🔇</div>
    <div class="shorts-scrim"></div>
    <div class="shorts-info">
      <div class="shorts-creator" data-action="open-creator">
        <span>📺 ${escapeHtml(item.channel_name || 'Unknown creator')}</span>
      </div>
      <div class="shorts-title">${escapeHtml(item.title || '')}</div>
      ${item.location ? `<div class="shorts-meta"><span>${escapeHtml(item.location)}</span></div>` : ''}
    </div>
    <div class="shorts-actions">
      <div>
        <button class="shorts-action-btn ${isLiked ? 'liked' : ''}" data-action="like">${isLiked ? '❤️' : '🤍'}</button>
        <div class="shorts-action-label">Save</div>
      </div>
      <div>
        <button class="shorts-action-btn" data-action="comments">💬</button>
        <div class="shorts-action-label">Comments</div>
      </div>
      <div>
        <button class="shorts-action-btn" data-action="share">↗</button>
        <div class="shorts-action-label">Share</div>
      </div>
      <div>
        <a class="shorts-action-btn" href="https://www.youtube.com/watch?v=${encodeURIComponent(item.youtube_video_id)}" target="_blank" rel="noopener" style="text-decoration:none;">▶</a>
        <div class="shorts-action-label">YouTube</div>
      </div>
    </div>
  `;

  el.querySelector('[data-action="tap-catcher"]').addEventListener('click', (e) => handleTapCatcherTap(e, el, item));
  el.querySelector('[data-action="open-creator"]').addEventListener('click', () => {
    window.location.href = creatorUrl({ youtube_channel_id: item.youtube_channel_id });
  });
  el.querySelector('[data-action="like"]').addEventListener('click', (e) => toggleLike(item, e.currentTarget));
  el.querySelector('[data-action="comments"]').addEventListener('click', () => openComments(item));
  el.querySelector('[data-action="share"]').addEventListener('click', () => shareItem(item));

  return el;
}

// Single tap = mute toggle, double tap = like (Instagram/TikTok convention).
// A single tap's action is held for TAP_DELAY_MS to see whether a second tap
// follows — the standard, only-reliable-across-browsers way to disambiguate
// the two on a touchscreen, at the cost of a small (~250ms) delay before a
// genuine single tap toggles mute.
const TAP_DELAY_MS = 250;
const tapState = new WeakMap(); // slide el -> { count, timer }

function handleTapCatcherTap(e, slideEl, item) {
  const state = tapState.get(slideEl) || { count: 0, timer: null };
  state.count += 1;

  if (state.count === 1) {
    state.timer = setTimeout(() => {
      toggleMute(slideEl);
      state.count = 0;
    }, TAP_DELAY_MS);
  } else {
    clearTimeout(state.timer);
    state.count = 0;
    likeWithHeartBurst(item, slideEl, e);
  }
  tapState.set(slideEl, state);
}

async function likeWithHeartBurst(item, slideEl, e) {
  const rect = slideEl.getBoundingClientRect();
  spawnHeartBurst(slideEl, e.clientX - rect.left, e.clientY - rect.top);

  // Double-tap always likes — it never un-likes an already-saved Short, same
  // as Instagram: tapping twice on something you've already liked just
  // replays the animation.
  if (favouriteIds.has(item.id)) return;
  const btn = slideEl.querySelector('[data-action="like"]');
  await toggleLike(item, btn);
}

function spawnHeartBurst(slideEl, x, y) {
  const el = document.createElement('div');
  el.className = 'shorts-heart-burst burst';
  el.textContent = '❤️';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  slideEl.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function toggleMute(slideEl) {
  const index = Number(slideEl.dataset.index);
  const player = players.get(index);
  if (!player) return;
  isMuted = !isMuted;
  try {
    if (isMuted) player.mute();
    else player.unMute();
  } catch {
    return; // player object exists but isn't ready yet — ignore this tap
  }

  const flash = slideEl.querySelector('[data-mute-flash]');
  flash.textContent = isMuted ? '🔇' : '🔊';
  flash.classList.add('show');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => flash.classList.remove('show'), 500);
}

async function toggleLike(item, btn) {
  if (!getCurrentUser()) {
    showToast('Sign in to save Shorts');
    return;
  }
  const isLiked = favouriteIds.has(item.id);
  try {
    if (isLiked) {
      await fetch(`/api/favourites/${encodeURIComponent(item.id)}`, { method: 'DELETE', credentials: 'include' });
      favouriteIds.delete(item.id);
      btn.textContent = '🤍';
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
      btn.textContent = '❤️';
      btn.classList.add('liked');
      showToast('Added to favourites 🔖');
      postShortsEvent(item, 'liked');
    }
  } catch {
    showToast('Something went wrong — please try again.');
  }
}

// Personalization signal (see functions/api/shorts/event.js and
// shared/constants.js's SHORTS_AFFINITY_WEIGHTS) — fire-and-forget, never
// awaited, never blocks playback. sendBeacon is preferred because it's
// specifically designed to survive the exact moment this usually fires: the
// viewer already scrolling to the next slide or navigating away.
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

// Classifies how the viewer treated the slide they just left: a quick bail
// (<3s) counts against that category/creator, a near-complete watch (>=80%
// of the video's own duration, or a flat 8s floor when duration is unknown)
// counts in favor. Anything in between is a neutral partial watch — not
// strong enough signal either way, so no event fires.
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

// Flushes the currently-active slide's dwell event on tab close/navigation —
// setActive() only records the *previous* slide when the *next* one becomes
// active, so without this the very last slide a viewer watched before
// leaving would never get scored.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') recordDwellEvent(currentIndex);
});

// Comments are real YouTube data (functions/api/videos/[id]/comments.js) —
// read-only, viewers reply on YouTube itself. One shared sheet reused across
// slides rather than building a drawer per slide.
const commentsBackdrop = document.getElementById('comments-backdrop');
const commentsSheet = document.getElementById('comments-sheet');
const commentsList = document.getElementById('comments-list');
let commentsRequestToken = 0;

async function openComments(item) {
  commentsBackdrop.classList.add('open');
  commentsSheet.classList.add('open');
  commentsList.innerHTML = `<div class="loading" style="padding:24px 0;"><div class="spinner"></div></div>`;

  const requestToken = ++commentsRequestToken;
  try {
    const { comments, disabled } = await apiFetch(`/videos/${encodeURIComponent(item.youtube_video_id)}/comments`);
    if (requestToken !== commentsRequestToken) return; // viewer already moved to a different Short — drop this stale response

    if (disabled) {
      commentsList.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">Comments are off for this video.</div>`;
    } else if (!comments.length) {
      commentsList.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">No comments yet.</div>`;
    } else {
      commentsList.innerHTML = comments.map(commentItemHTML).join('');
    }
  } catch {
    if (requestToken !== commentsRequestToken) return;
    commentsList.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">Couldn't load comments — please try again.</div>`;
  }
}

function commentItemHTML(c) {
  const avatar = c.authorAvatar || '';
  return `
    <div class="shorts-comment-item">
      <img class="shorts-comment-avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="shorts-comment-body">
        <div class="shorts-comment-author">${escapeHtml(c.author || 'YouTube user')}</div>
        <div class="shorts-comment-text">${escapeHtml(c.text || '')}</div>
        <div class="shorts-comment-meta">
          ${c.likeCount ? `<span>👍 ${escapeHtml(String(c.likeCount))}</span>` : ''}
          ${c.publishedAt ? `<span>${new Date(c.publishedAt).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function closeComments() {
  commentsBackdrop.classList.remove('open');
  commentsSheet.classList.remove('open');
  commentsRequestToken++; // invalidate any in-flight fetch so a late response can't reopen/repopulate a closed sheet
}

commentsBackdrop.addEventListener('click', closeComments);
document.getElementById('comments-close').addEventListener('click', closeComments);

async function shareItem(item) {
  const url = `${window.location.origin}/shorts/${item.youtube_video_id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, url });
    } catch {
      /* user cancelled the share sheet — not an error */
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

// Loaded lazily (not a static <script> tag) so it doesn't block the page,
// and so we control exactly when player creation is allowed to start.
let ytApiPromise = null;
function loadYouTubeApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

async function ensurePlayer(index) {
  if (index < 0 || index >= items.length) return;
  if (players.has(index)) return;
  const YT = await loadYouTubeApi();
  // Guard against a fast-scrolling viewer racing past this slide before the
  // async API load resolved, and against double-creation from overlapping calls.
  if (players.has(index) || index >= items.length) return;
  const item = items[index];
  const player = new YT.Player(`yt-player-${index}`, {
    videoId: item.youtube_video_id,
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 1,
      rel: 0,
      fs: 0,
      playsinline: 1,
      loop: 1,
      playlist: item.youtube_video_id, // required by the API for loop:1 to work on a single video
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
    // Only the still-current slide should actually start playing — guards
    // against a stale ensurePlayer() resolving after the viewer has already
    // scrolled further. Also guards against calling playVideo() on a brand
    // new Player object whose methods aren't attached yet — the YT IFrame
    // API only fully wires up the instance once onReady fires, which is
    // where a *new* player's autoplay actually starts; this call only needs
    // to cover the revisit case (a player created earlier, already ready).
    if (index !== currentIndex) return;
    try {
      players.get(index)?.playVideo();
    } catch {
      /* not ready yet — the onReady handler will start it once it fires */
    }
  });
  ensurePlayer(index + 1); // preload exactly one video ahead, per the memory/perf budget

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
    /* transient — the viewer just won't get more until the next scroll-triggered retry */
  } finally {
    loadingMore = false;
  }
}

function appendEndMarker() {
  if (feedEl.querySelector('.shorts-end')) return;
  const el = document.createElement('div');
  el.className = 'shorts-end';
  el.innerHTML = `<div style="font-size:28px;">🏔️</div><div>You're all caught up</div><a href="/pages/browse.html" style="color:var(--red);font-weight:600;">Browse more videos →</a>`;
  feedEl.appendChild(el);
}

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
        // Nothing crossed the active threshold this tick (e.g. mid-scroll) —
        // still pause anything that dropped fully out of view.
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
    { root: feedEl, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
  );
  slideEls.forEach((el) => observer.observe(el));
}

// Desktop keyboard nav — touch swipe is handled natively by CSS scroll-snap
// on .shorts-feed, which already gives correct paging + momentum on mobile
// without a hand-rolled touch handler fighting the browser's own scrolling.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const target = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
  slideEls[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
