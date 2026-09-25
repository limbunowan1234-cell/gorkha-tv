import { apiFetch, ytThumb, watchUrl, creatorUrl, formatViews, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';
import { loadYouTubeApi } from './youtubeApi.js';
import { initComments } from './comments.js';
import { syncQueuePosition, upcomingQueueItems } from './queue.js';
import { registerTeardown, navigate } from './router.js';
import { playTrack, dockInto, undockToMini } from './playerBar.js';

// GorkhaTV Beats' pink — same value as js/genres.js / functions/genre/
// [slug].js's GENRE_CONFIG.music, duplicated here per this codebase's
// existing convention of small constants living per-file rather than a
// shared import for a single color value.
const BEATS_COLOR = '#E0479E';
// Sitewide default --red (css/style.css's :root) — duplicated here per this
// codebase's small-per-file-constant convention, same as BEATS_COLOR above.
const DEFAULT_RED = '#E8192C';

let ytPlayer = null;
let currentVideo = null;
let progressSyncTimer = null;
let relatedVideos = []; // populated by loadRelated(); doubles as the autoplay "up next" candidate list when there's no active queue
let queueActive = false; // true only when the current video actually belongs to a stored gtv_queue (see js/queue.js)
let autoplayCountdownTimer = null;

const AUTOPLAY_STORAGE_KEY = 'gtv_autoplay';
const AUTOPLAY_COUNTDOWN_SECONDS = 5;

// Videos already watched this tab session (sessionStorage — cleared when the
// tab closes, not a permanent history) — used only to keep autoplay from
// looping back to a song it already played. Every video visited counts, not
// just autoplay-driven ones, so manually clicking a related video still
// keeps it out of later autoplay suggestions too.
const AUTOPLAY_HISTORY_KEY = 'gtv_autoplay_history';

function getAutoplayHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTOPLAY_HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function addToAutoplayHistory(id) {
  try {
    const history = getAutoplayHistory();
    if (!history.includes(id)) {
      history.push(id);
      sessionStorage.setItem(AUTOPLAY_HISTORY_KEY, JSON.stringify(history));
    }
  } catch {
    /* best-effort — worst case autoplay can repeat a song, not a functional break */
  }
}

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
  // This module is re-imported fresh on every Beats-router transition (see
  // js/router.js's entryScriptFor()), not just on a real page load — so
  // anything from a PREVIOUS instance that outlives its own module (a
  // setInterval id, a document/window-level listener) must be explicitly
  // torn down here, first, or it silently keeps running forever alongside
  // whatever this fresh instance sets up next.
  clearInterval(progressSyncTimer);
  clearInterval(autoplayCountdownTimer);
  if (window.__gtvVisibilityHandler) document.removeEventListener('visibilitychange', window.__gtvVisibilityHandler);
  window.__gtvVisibilityHandler = () => {
    if (document.visibilityState === 'hidden') syncProgress();
  };
  document.addEventListener('visibilitychange', window.__gtvVisibilityHandler);
  registerTeardown(() => {
    clearInterval(progressSyncTimer);
    clearInterval(autoplayCountdownTimer);
    // No-op if this page never docked the iframe big (e.g. a non-music
    // video) — always registered unconditionally, same as the timers above,
    // so the iframe is guaranteed to never be a descendant of #page-content
    // at the moment the NEXT transition's innerHTML swap runs.
    undockToMini();
  });

  await initAuthNav();

  const id = getVideoIdFromPath();
  if (!id) return renderNotFound();

  addToAutoplayHistory(id);
  queueActive = syncQueuePosition(id);

  try {
    const { video } = await apiFetch(`/videos/${encodeURIComponent(id)}`);
    currentVideo = video;
    renderVideo(video);
    initFavouriteButton(video);
    initComments(video);
    initAutoplayToggle();
    loadRelated(id);
    recordView(id);
    // GorkhaTV Beats hands actual playback off to the persistent player bar
    // (js/playerBar.js) instead of creating its own throwaway YT.Player —
    // that's the one thing that lets the track keep playing if the viewer
    // then navigates to the chart or back to /genre/music. Every other
    // category keeps today's exact behavior (its own player, dies on
    // navigation like before — the router doesn't intercept those pages at
    // all, so there's nothing to hand off to).
    if (video.category === 'music') {
      renderBeatsPlayerArea(video); // thumbnail placeholder, shown immediately
      await playTrack(video); // awaited so the iframe element exists before docking
      dockInto('watch-player');
    } else {
      initPlayer(video);
    }
  } catch (err) {
    renderNotFound();
  }
}

// Brief loading placeholder for the big player slot, shown immediately while
// playTrack() (async — loads the YT API if needed) resolves; dockInto()
// swaps the real, live iframe in right after, moved here from its home in
// the persistent bar (js/playerBar.js) rather than a second player being
// created — see that file's own header comment.
function renderBeatsPlayerArea(v) {
  const mount = document.getElementById('watch-player');
  if (!mount) return;
  mount.innerHTML = `<img src="${escapeHtml(ytThumb(v))}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
}

// GorkhaTV Beats gets Spotify-style "now playing" chrome (square album-art-
// style player, centered title/artist, pink theme) — every other category
// keeps today's plain video-watch layout unchanged. Same --red retinting
// trick js/genre.js already uses for the genre pages, so this reads as the
// same brand rather than a one-off. Always sets --red (to pink, or back to
// the sitewide default) rather than only ever overriding it — since the
// router (js/router.js) can land here right after a pink Beats page, and
// <html> itself is never swapped, a non-music video needs this to actively
// reset the theme, not just skip touching it.
function applyBeatsChrome(v) {
  const isMusic = v.category === 'music';
  document.querySelector('.watch-wrap')?.classList.toggle('beats-mode', isMusic);
  document.documentElement.style.setProperty('--red', isMusic ? BEATS_COLOR : DEFAULT_RED);
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
// (populated by loadRelated() below — no separate fetch). Picks the first
// related candidate not already played this tab session (see
// AUTOPLAY_HISTORY_KEY above), so a tight cluster of songs that keep
// recommending each other doesn't loop — if every related video has
// already been played, autoplay simply has nothing new to offer and stays
// silent rather than repeating one. Counts down in plain text (no animated
// ring) — matches this codebase's existing plain-CSS, no-heavy-animation
// style elsewhere (the analytics chart, the stat cards).
function maybeShowAutoplayOverlay() {
  if (!isAutoplayOn()) return;
  const history = getAutoplayHistory();
  // A GorkhaTV Beats queue (chart/Top-10 click) takes priority over the
  // generic related-videos list — this is what makes "up next" actually
  // play through the ranked list a viewer started from, not just whatever
  // else happens to be related to the current song. Falls back to
  // relatedVideos once the queue runs out, same as loadRelated()'s sidebar.
  const queueNext = queueActive ? upcomingQueueItems().find((v) => !history.includes(v.youtube_video_id)) : null;
  const next = queueNext || relatedVideos.find((v) => !history.includes(v.youtube_video_id));
  if (!next) return;
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
    navigate(watchUrl(next, { autoplay: true }));
  };
  document.getElementById('autoplay-cancel-btn').onclick = hideAutoplayOverlay;

  autoplayCountdownTimer = setInterval(() => {
    secondsLeft -= 1;
    const countdownEl = document.getElementById('autoplay-countdown');
    if (countdownEl) countdownEl.textContent = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(autoplayCountdownTimer);
      navigate(watchUrl(next, { autoplay: true }));
    }
  }, 1000);
}

function hideAutoplayOverlay() {
  clearInterval(autoplayCountdownTimer);
  const overlay = document.getElementById('autoplay-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderVideo(v) {
  document.title = `${v.title} | GorkhaTV`;
  applyBeatsChrome(v);

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
      navigate(creatorUrl({ youtube_channel_id: v.youtube_channel_id, slug: v.channel_slug }));
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

  // A track played from GorkhaTV Beats' chart/Top-10 (js/queue.js's stored
  // gtv_queue) takes over the sidebar as a real "Up Next" list — still
  // fetches relatedVideos below so autoplay has something to fall back to
  // once the queue runs out, but doesn't show "More like this" while a
  // queue is actively driving the session.
  if (queueActive) {
    const upcoming = upcomingQueueItems();
    if (upcoming.length) {
      const heading = document.getElementById('related-heading');
      if (heading) heading.textContent = 'Up Next';
      el.innerHTML = upcoming.map((r) => relatedItemHTML(r)).join('');
    }
  }

  try {
    const { related } = await apiFetch(`/videos/${encodeURIComponent(id)}/related`);
    relatedVideos = related; // autoplay's fallback "up next" source once the queue (if any) is exhausted — see maybeShowAutoplayOverlay()
    if (queueActive && upcomingQueueItems().length) return; // Up Next is already showing, above — don't overwrite it

    if (!related.length) {
      el.innerHTML = `<div style="color:var(--muted);font-size:13px;">No related videos yet.</div>`;
      return;
    }
    el.innerHTML = related.map((r) => relatedItemHTML(r)).join('');
  } catch {
    if (!queueActive) el.innerHTML = '';
  }
}

function relatedItemHTML(r) {
  return `
    <a class="related-item" href="${watchUrl(r)}">
      <div class="related-thumb"><img src="${escapeHtml(ytThumb(r))}" loading="lazy" alt="" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(r.youtube_video_id)}/default.jpg'"></div>
      <div>
        <div class="related-title">${escapeHtml(r.title)}</div>
        <div class="related-sub">${escapeHtml(r.channel_name || '')}</div>
      </div>
    </a>`;
}

function renderNotFound() {
  document.getElementById('watch-title').textContent = 'Video not found';
  document.getElementById('watch-desc').textContent = 'This video may have been removed, or the link is incorrect.';
  document.getElementById('watch-player').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);">Unavailable</div>`;
  document.getElementById('related-list').innerHTML = '';
}

init();
