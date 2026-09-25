// GorkhaTV Beats' persistent "now playing" bar — the ONE thing that makes
// Tier 3 (music keeps playing while you browse) actually work: its root
// DOM node (#player-bar-root, including the real YouTube iframe inside it)
// lives OUTSIDE the swappable #page-content region every router-participating
// template defines, so js/router.js's innerHTML swap never touches it — the
// iframe is never removed from the document, so playback simply continues
// through a page "transition."
//
// A Beats watch page shows the REAL live video (not a static album-art
// image) via dockInto()/undockToMini() below — the same iframe (found by id,
// never recreated) is appendChild()-moved between its mini-bar home and the
// watch page's big player slot. This was originally shipped as an
// always-small bar specifically to avoid that reparenting, but it's since
// been confirmed safe directly against production: moving the live iframe
// mid-playback produced zero new network requests and the video kept
// playing continuously through the move (see the Phase Q plan section for
// the full empirical trace). js/watch.js owns the dock/undock decision
// (it knows "which page am I on"; this module only knows tracks/queue) and
// registers the undock as a router teardown so the iframe is never a
// descendant of #page-content at the moment a swap runs.
import { loadYouTubeApi } from './youtubeApi.js';
import { ytThumb, escapeHtml, watchUrl } from './api.js';
import { syncQueuePosition, upcomingQueueItems, previousQueueItem } from './queue.js';
import { navigate } from './router.js';

const BEATS_COLOR = '#E0479E';
const PROGRESS_POLL_MS = 500;

let ytPlayer = null;
let currentTrack = null;
let progressPollTimer = null;
let progressSyncTimer = null;

function root() {
  return document.getElementById('player-bar-root');
}

// Called once per page load (every participating template includes this
// module) — renders the bar shell if it doesn't exist yet. Note this
// module is NEVER re-imported by the router (only watch.js/chart.js/
// genre.js are, per entryScriptFor() — playerBar.js is loaded once and its
// exported functions are called directly from then on), so its internal
// state (ytPlayer, currentTrack, the timers) is safe from the re-import
// leak risk router.js's registerTeardown exists to solve for the others.
export function initPlayerBar() {
  const el = root();
  if (!el) return;
  el.innerHTML = `
    <a class="player-bar-thumb" id="player-bar-thumb" href="#"></a>
    <div class="player-bar-info">
      <div class="player-bar-title" id="player-bar-title"></div>
      <div class="player-bar-artist" id="player-bar-artist"></div>
    </div>
    <button class="player-bar-playpause" id="player-bar-playpause" aria-label="Play/Pause">▶</button>
    <div class="player-bar-progress"><div class="player-bar-progress-fill" id="player-bar-progress-fill"></div></div>
    <div class="player-bar-yt" id="player-bar-yt"></div>
  `;
  document.getElementById('player-bar-playpause').onclick = togglePlayPause;
  document.getElementById('player-bar-thumb').onclick = (e) => {
    e.preventDefault();
    if (currentTrack) navigate(watchUrl(currentTrack));
  };
  initMediaSession();
  render();
}

// Lock-screen / OS-level media controls (Android notification shade, desktop
// OS media keys) — registered once, since the handlers themselves don't
// change per track, only the metadata (set in render()) and playback state
// (set in onPlayerStateChange()) do. Untested on iOS: the actual audio
// decodes inside a cross-origin YouTube iframe, which this page can't claim
// Media Session ownership over the way it could for its own <video>/<audio>
// element — this is registered on the (reasonable) chance it still helps on
// Android/desktop, not a guarantee it survives a fully backgrounded mobile
// browser. See this session's own conversation for the full reasoning.
function initMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
  });
  navigator.mediaSession.setActionHandler('nexttrack', advanceToNextInQueue);
  navigator.mediaSession.setActionHandler('previoustrack', goToPreviousInQueue);
}

function updateMediaSessionMetadata() {
  if (!('mediaSession' in navigator) || !currentTrack) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTrack.title || '',
    artist: currentTrack.channel_name || '',
    artwork: [{ src: ytThumb(currentTrack), sizes: '480x360', type: 'image/jpeg' }],
  });
}

// Moves the SAME live iframe (found by id, never recreated) into `targetId`'s
// element and switches it to fill that container — the exact appendChild-
// based move confirmed safe against production (see this module's own header
// comment). Idempotent — safe to call again if already docked there.
export function dockInto(targetId) {
  const target = document.getElementById(targetId);
  const ytEl = document.getElementById('player-bar-yt');
  if (!target || !ytEl || ytEl.parentElement === target) return;
  target.innerHTML = ''; // clears watch.js's static-thumbnail loading placeholder
  target.appendChild(ytEl);
  ytEl.classList.add('docked-big');
}

// Moves the iframe back to its home in the mini bar. appendChild always
// appends at the end, which is already #player-bar-yt's natural last-child
// position in the bar's own flex row (see initPlayerBar()'s markup above) —
// no explicit position bookkeeping needed. Idempotent — safe to call even if
// never docked.
export function undockToMini() {
  const bar = root();
  const ytEl = document.getElementById('player-bar-yt');
  if (!bar || !ytEl || ytEl.parentElement === bar) return;
  ytEl.classList.remove('docked-big');
  bar.appendChild(ytEl);
}

export function isActive() {
  return !!currentTrack;
}

export function getCurrentTrack() {
  return currentTrack;
}

// Starts (or resumes, if already this track) playback of `video`. `queue`/
// `queueIndex` are optional — passed when starting from a chart/Top-10
// click so the bar's own "up next" logic (via js/queue.js, already seeded
// by the caller) stays in sync.
export async function playTrack(video) {
  const el = root();
  if (!el) return;

  document.body.classList.add('gtv-player-active');
  document.documentElement.style.setProperty('--red', BEATS_COLOR);

  if (currentTrack && currentTrack.youtube_video_id === video.youtube_video_id) {
    render();
    return; // already playing this track (e.g. re-entered its watch page) — don't restart it
  }

  currentTrack = video;
  syncQueuePosition(video.youtube_video_id);
  render();

  const YT = await loadYouTubeApi();
  if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
    // Same long-lived player, just told to switch tracks — no iframe
    // destroy/recreate, no reload flicker.
    ytPlayer.loadVideoById(video.youtube_video_id);
    return;
  }

  ytPlayer = new YT.Player('player-bar-yt', {
    videoId: video.youtube_video_id,
    playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0 },
    events: {
      onReady: (e) => e.target.playVideo(),
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerStateChange(e) {
  const YT = window.YT;
  if (!YT) return;
  const btn = document.getElementById('player-bar-playpause');
  if (e.data === YT.PlayerState.PLAYING) {
    if (btn) btn.textContent = '⏸';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    clearInterval(progressPollTimer);
    progressPollTimer = setInterval(updateProgressBar, PROGRESS_POLL_MS);
    clearInterval(progressSyncTimer);
    progressSyncTimer = setInterval(syncProgressToServer, 20000);
  } else {
    if (btn) btn.textContent = '▶';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    clearInterval(progressPollTimer);
    if (e.data === YT.PlayerState.PAUSED) {
      clearInterval(progressSyncTimer);
      syncProgressToServer();
    }
    if (e.data === YT.PlayerState.ENDED) {
      clearInterval(progressSyncTimer);
      syncProgressToServer();
      advanceToNextInQueue();
    }
  }
}

// Same real on-site progress signal watch.js already sent per-page — now
// centralized here since this is the single long-lived player. Best-effort,
// same sendBeacon-with-fetch-fallback pattern.
function syncProgressToServer() {
  if (!ytPlayer || !currentTrack || typeof ytPlayer.getCurrentTime !== 'function') return;
  const progressSeconds = ytPlayer.getCurrentTime();
  const durationSeconds = ytPlayer.getDuration();
  if (!durationSeconds) return;
  const payload = JSON.stringify({
    progressSeconds,
    durationSeconds,
    category: currentTrack.category,
    channelId: currentTrack.youtube_channel_id,
  });
  const url = `/api/videos/${encodeURIComponent(currentTrack.youtube_video_id)}/progress`;
  if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
  else fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
}

function advanceToNextInQueue() {
  const next = upcomingQueueItems()[0];
  if (!next) return;
  playTrack(next);
  // If the viewer is sitting on a watch page, bring its content/URL in
  // sync with the new track too — router.navigate() is a no-op fallback to
  // a real link click if we're somehow not on a router-participating page.
  if (window.location.pathname.startsWith('/watch/')) navigate(watchUrl(next));
}

// Mirrors advanceToNextInQueue() exactly, one position earlier — the
// lock-screen/OS "previous track" control's only handler (js/queue.js's
// previousQueueItem()). No-op (button simply does nothing) if there's no
// active queue or we're already at its first item.
function goToPreviousInQueue() {
  const prev = previousQueueItem();
  if (!prev) return;
  playTrack(prev);
  if (window.location.pathname.startsWith('/watch/')) navigate(watchUrl(prev));
}

function togglePlayPause() {
  if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
  const YT = window.YT;
  if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
}

function updateProgressBar() {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
  const duration = ytPlayer.getDuration();
  if (!duration) return;
  const fill = document.getElementById('player-bar-progress-fill');
  if (fill) fill.style.width = `${Math.min(100, (ytPlayer.getCurrentTime() / duration) * 100)}%`;
}

function render() {
  const el = root();
  if (!el || !currentTrack) return;
  el.style.display = 'flex';
  const thumbLink = document.getElementById('player-bar-thumb');
  thumbLink.href = watchUrl(currentTrack);
  thumbLink.style.backgroundImage = `url(${escapeHtml(ytThumb(currentTrack))})`;
  document.getElementById('player-bar-title').textContent = currentTrack.title || '';
  document.getElementById('player-bar-artist').textContent = currentTrack.channel_name || '';
  updateMediaSessionMetadata();
}

// Self-invokes once per real page load, same convention as js/mobileNav.js
// — and, unlike watch.js/chart.js/genre.js, this module is never
// re-imported by the router (only entry scripts are, per router.js's
// entryScriptFor()), so this only ever runs once per browsing session
// until an actual full reload happens. That's exactly what keeps
// #player-bar-yt's live iframe — and everything else this module owns —
// intact across every swap.
initPlayerBar();
