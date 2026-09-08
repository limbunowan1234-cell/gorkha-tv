import { apiFetch, ytThumb, watchUrl, creatorUrl, formatViews, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';
import { loadYouTubeApi } from './youtubeApi.js';
import { initComments } from './comments.js';

let ytPlayer = null;
let currentVideo = null;
let progressSyncTimer = null;
let relatedVideos = []; // populated by loadRelated(); relatedVideos[0] doubles as the autoplay "up next" candidate
let autoplayCountdownTimer = null;

const AUTOPLAY_STORAGE_KEY = 'gtv_autoplay';
const AUTOPLAY_COUNTDOWN_SECONDS = 5;

// Unset = on, matching real YouTube's default and the confirmed product
// choice here — only an explicit "off" turns it off.
function isAutoplayOn() {
  try {
    return localStorage.getItem(AUTOPLAY_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function setAutoplay(on) {
  try {
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* per-viewer convenience only — playback still works without persistence */
  }
}

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
    currentVideo = video;
    renderVideo(video);
    initFavouriteButton(video);
    initComments(video);
    initAutoplayToggle();
    loadRelated(id);
    recordView(id);
    initPlayer(video);
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

// Real YT.Player (not a plain <iframe>) so playback progress can actually be
// read — powers the homepage "Continue Watching" row and lets a viewer
// resume where they left off. A direct visit never autoplays (a viewer
// still clicks play themselves) — but a navigation that came FROM the
// autoplay overlay below carries "?autoplay=1" (see watchUrl()'s optional
// param), and this is where that actually takes effect: without it, the
// overlay would advance to the right page but leave the new video sitting
// there requiring another click, which defeats the point of "autoplay".
async function initPlayer(v) {
  const YT = await loadYouTubeApi();
  const shouldAutoplay = new URLSearchParams(window.location.search).get('autoplay') === '1';
  // #watch-player already has the right aspect-ratio/sizing CSS from the
  // plain-iframe era (.watch-player { aspect-ratio:16/9 } / iframe {
  // width:100%;height:100% }) — YT.Player replaces the div in place and the
  // resulting iframe picks up the same rules, no template changes needed.
  ytPlayer = new YT.Player('watch-player', {
    videoId: v.youtube_video_id,
    playerVars: { autoplay: shouldAutoplay ? 1 : 0, rel: 0, playsinline: 1 },
    events: {
      onReady: async (e) => {
        try {
          const { progress } = await apiFetch(`/videos/${encodeURIComponent(v.youtube_video_id)}/progress`);
          if (progress && progress.duration_seconds && progress.progress_seconds < progress.duration_seconds * 0.9) {
            e.target.seekTo(progress.progress_seconds, true);
          }
        } catch {
          /* resume is a nice-to-have — playback still works without it */
        }
        // playerVars.autoplay alone doesn't always fire in every browser/
        // embed context — an explicit playVideo() call is the standard,
        // more reliable belt-and-suspenders pairing with it.
        if (shouldAutoplay) e.target.playVideo();
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          clearInterval(progressSyncTimer);
          progressSyncTimer = setInterval(syncProgress, 20000);
          hideAutoplayOverlay(); // a viewer replaying/scrubbing back into the video cancels any pending advance
        } else {
          clearInterval(progressSyncTimer);
          if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) syncProgress();
          if (e.data === YT.PlayerState.ENDED) maybeShowAutoplayOverlay();
        }
      },
    },
  });
}

function syncProgress() {
  if (!ytPlayer || !currentVideo || typeof ytPlayer.getCurrentTime !== 'function') return;
  const progressSeconds = ytPlayer.getCurrentTime();
  const durationSeconds = ytPlayer.getDuration();
  if (!durationSeconds) return;

  const payload = JSON.stringify({
    progressSeconds,
    durationSeconds,
    category: currentVideo.category,
    channelId: currentVideo.youtube_channel_id,
  });
  const url = `/api/videos/${encodeURIComponent(currentVideo.youtube_video_id)}/progress`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  }
}

// Toggle sits in .watch-actions next to My List/Watch on YouTube. Reflects
// and updates the same localStorage flag isAutoplayOn()/setAutoplay() read
// and write, so it stays in sync with the ENDED-state behavior below.
function initAutoplayToggle() {
  const btn = document.getElementById('watch-autoplay-btn');
  if (!btn) return;
  const render = () => {
    const on = isAutoplayOn();
    btn.textContent = on ? '▶️ Autoplay: On' : '▶️ Autoplay: Off';
    btn.classList.toggle('active', on);
  };
  render();
  btn.onclick = () => {
    setAutoplay(!isAutoplayOn());
    render();
    if (!isAutoplayOn()) hideAutoplayOverlay();
  };
}

// YouTube-style "up next" card: shown over the player when the current
// video ends, autoplay is on, and there's a related video to advance to
// (relatedVideos[0], populated by loadRelated() below — no separate fetch).
// Counts down in plain text (no animated ring) — matches this codebase's
// existing plain-CSS, no-heavy-animation style elsewhere (the analytics
// chart, the stat cards).
function maybeShowAutoplayOverlay() {
  if (!isAutoplayOn() || !relatedVideos.length) return;
  const next = relatedVideos[0];
  const overlay = document.getElementById('autoplay-overlay');
  if (!overlay) return;

  let secondsLeft = AUTOPLAY_COUNTDOWN_SECONDS;
  overlay.innerHTML = `
    <div class="autoplay-card" id="autoplay-card">
      <div class="autoplay-thumb"><img src="${escapeHtml(ytThumb(next))}" alt=""></div>
      <div class="autoplay-info">
        <div class="autoplay-label">Playing next in <span id="autoplay-countdown">${secondsLeft}</span>…</div>
        <div class="autoplay-next-title">${escapeHtml(next.title)}</div>
      </div>
      <button class="autoplay-cancel-btn" id="autoplay-cancel-btn">Cancel</button>
    </div>`;
  overlay.style.display = 'flex';

  document.getElementById('autoplay-card').onclick = (e) => {
    if (e.target.closest('#autoplay-cancel-btn')) return;
    window.location.href = watchUrl(next, { autoplay: true });
  };
  document.getElementById('autoplay-cancel-btn').onclick = hideAutoplayOverlay;

  autoplayCountdownTimer = setInterval(() => {
    secondsLeft -= 1;
    const countdownEl = document.getElementById('autoplay-countdown');
    if (countdownEl) countdownEl.textContent = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(autoplayCountdownTimer);
      window.location.href = watchUrl(next, { autoplay: true });
    }
  }, 1000);
}

function hideAutoplayOverlay() {
  clearInterval(autoplayCountdownTimer);
  const overlay = document.getElementById('autoplay-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Flushes progress on tab-hide/navigation-away — onStateChange only catches
// an explicit pause/end, not the viewer just closing the tab mid-playback.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') syncProgress();
});

function renderVideo(v) {
  document.title = `${v.title} | GorkhaTV`;

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
  initDescriptionToggle();
}

// Descriptions clamp to 5 lines by default (see .watch-desc.clamped) — only
// show the toggle when the text actually overflows that, so a short
// description never gets a pointless "Show more" button.
function initDescriptionToggle() {
  const desc = document.getElementById('watch-desc');
  const btn = document.getElementById('watch-desc-toggle');
  desc.classList.add('clamped');
  btn.textContent = 'Show more';
  btn.style.display = desc.scrollHeight > desc.clientHeight + 1 ? '' : 'none';
  btn.onclick = () => {
    const expanded = desc.classList.toggle('clamped') === false;
    btn.textContent = expanded ? 'Show less' : 'Show more';
  };
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
          body: JSON.stringify({ videoId: v.id, category: v.category, channelId: v.youtube_channel_id }),
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
    relatedVideos = related; // doubles as the autoplay "up next" queue — see maybeShowAutoplayOverlay()
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
