// GorkhaTV Beats' persistent "now playing" bar — the ONE thing that makes
// Tier 3 (music keeps playing while you browse) actually work: its root
// DOM node (#player-bar-root, including the real YouTube iframe inside it)
// lives OUTSIDE the swappable #page-content region every router-participating
// template defines, so js/router.js's innerHTML swap never touches it — the
// iframe is never removed from the document, so playback simply continues
// through a page "transition."
//
// A Beats watch page shows the REAL live video (not a static album-art
// image), but the iframe itself NEVER MOVES in the DOM — it always stays a
// child of #player-bar-root. dockInto()/undockToMini() below just toggle a
// CSS class that switches it between its tiny/invisible mini-bar styling and
// `position: fixed` coordinates matching a watch page's big player slot
// (synced every frame via requestAnimationFrame while docked, so it tracks
// scrolling/resizing/layout shifts). An earlier version of this file DID
// physically appendChild() the iframe between containers — confirmed
// directly against production that the move itself is harmless to playback
// (no reload, no new network request), but NOT to the YT.Player JS wrapper's
// control channel: every dock/undock broke postMessage command delivery
// (confirmed via a genuine browser warning — a command aimed at
// 'https://www.youtube.com' landing on a window whose origin was
// 'https://gorkhatv.site' — and by loadVideoById()/pauseVideo() silently
// no-opping afterward, no thrown error, no state-change event). Rebinding a
// fresh YT.Player wrapper after each move worked exactly once, then broke
// again the same way on a second rebind of an already-rebound iframe — not
// a viable fix. Never moving the iframe at all sidesteps the whole class of
// problem: the SAME wrapper, bound once, keeps working indefinitely.
import { loadYouTubeApi } from './youtubeApi.js';
import { ytThumb, escapeHtml, watchUrl } from './api.js';
import { syncQueuePosition, upcomingQueueItems, previousQueueItem } from './queue.js';
import { navigate } from './router.js';

const BEATS_COLOR = '#E6479D';
const PROGRESS_POLL_MS = 500;

let ytPlayer = null;
let currentTrack = null;
// The element dockInto() is currently visually covering, or null when
// undocked — drives syncDockPosition()'s per-frame CSS-coordinate sync.
let dockTarget = null;
let dockSyncRaf = null;
let progressPollTimer = null;
let progressSyncTimer = null;
// Set by watch.js's music branch (js/watch.js's own YouTube-style "up next"
// countdown overlay reuses maybeShowAutoplayOverlay(), unchanged, the exact
// same one regular videos already use) whenever a SWARA watch page is
// actively showing the big player — this module only knows tracks/queue,
// not "is a watch page currently visible with a countdown UI to show", so
// ended-track handling defers to whoever registered themselves as owning
// that decision, falling back to this module's own immediate-advance
// behavior (correct when the track ends while browsing some other page,
// where no countdown UI could be shown anyway). Reset to null by watch.js's
// own router teardown when navigating away from a music watch page.
let onEndedOverride = null;
export function setOnEndedHandler(fn) {
  onEndedOverride = fn;
}

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
  // Fire-and-forget, started as early as the page loads rather than on the
  // first click — loadYouTubeApi() does a real network fetch the first time
  // (the external iframe_api script), and if that fetch is still in flight
  // when playTrack() later does `new YT.Player(...)`, the click's brief
  // "user activation" window can expire while awaiting it — which is
  // exactly what unmuted autoplay needs, so only the FIRST track played in
  // a session would silently fail to autoplay. Warming it here means by the
  // time anyone actually clicks play, window.YT is already resolved and
  // loadYouTubeApi() returns synchronously, keeping the click's gesture
  // intact all the way to player creation.
  loadYouTubeApi();

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

// Per-frame position sync while docked — position:fixed coordinates are
// viewport-relative, so they need continuous recomputation against the
// target's current getBoundingClientRect() to track scrolling, window
// resizes, and layout shifts (e.g. related-list images loading in below
// it). requestAnimationFrame rather than scroll/resize listeners: simpler
// (one thing to start/stop, no listener cleanup to forget) and correctly
// covers every cause of the target's rect moving, not just those two.
function syncDockPosition() {
  if (!dockTarget) return;
  const ytEl = document.getElementById('player-bar-yt');
  if (!ytEl || !dockTarget.isConnected) {
    // The router swapped #page-content (dockTarget's own element got
    // destroyed) without an explicit undockToMini() call in between —
    // shouldn't happen given watch.js's unconditional teardown registration,
    // but fail safe rather than spin a rAF loop chasing a dead element.
    undockToMini();
    return;
  }
  const rect = dockTarget.getBoundingClientRect();
  ytEl.style.left = `${rect.left}px`;
  ytEl.style.top = `${rect.top}px`;
  ytEl.style.width = `${rect.width}px`;
  ytEl.style.height = `${rect.height}px`;
  dockSyncRaf = requestAnimationFrame(syncDockPosition);
}

// Visually covers `targetId`'s element with the SAME live iframe (found by
// id, never moved in the DOM — see this file's header comment for why) via
// `position: fixed` coordinates kept in sync every frame. Idempotent — safe
// to call again while already docked to the same target.
export function dockInto(targetId) {
  const target = document.getElementById(targetId);
  const ytEl = document.getElementById('player-bar-yt');
  if (!target || !ytEl || dockTarget === target) return;
  dockTarget = target;
  ytEl.classList.add('docked-big');
  if (!dockSyncRaf) syncDockPosition();
}

// Reverts the iframe to its normal tiny/invisible mini-bar styling — since
// it never left #player-bar-root, this is just a class toggle and clearing
// the inline position/size the sync loop was setting. Idempotent — safe to
// call even if never docked.
export function undockToMini() {
  if (dockSyncRaf) {
    cancelAnimationFrame(dockSyncRaf);
    dockSyncRaf = null;
  }
  dockTarget = null;
  const ytEl = document.getElementById('player-bar-yt');
  if (!ytEl) return;
  ytEl.classList.remove('docked-big');
  ytEl.style.left = '';
  ytEl.style.top = '';
  ytEl.style.width = '';
  ytEl.style.height = '';
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

  await recreatePlayer(video);
}

// Always tears down and rebuilds the player from scratch on every track
// switch, rather than reusing the existing wrapper's loadVideoById() or
// re-adopting its iframe. Confirmed directly this session, the hard way:
// loadVideoById() on the untouched original wrapper silently broke on the
// very first switch (a genuine browser warning: a postMessage aimed at
// 'https://www.youtube.com' landing on a window whose origin was
// 'https://gorkhatv.site' — the SDK's internal frame reference had gone
// stale), even with the iframe never once moved in the DOM. Re-adopting the
// same never-destroyed iframe with a second `new YT.Player()` call worked
// exactly once, then failed the identical way on a third track — the SDK
// doesn't cleanly support a second live wrapper claiming an iframe another
// wrapper still thinks it owns. The one thing that has worked reliably in
// every test is a genuinely fresh iframe: destroy() the old player (which
// removes its <iframe> outright), rebuild the placeholder <div>, and let
// `new YT.Player()` create a brand-new widget, exactly like the very first
// track of a session always has. Most likely cause of the staleness in the
// first place: AdSense reloading ad iframes elsewhere on the page on each
// SPA "page view," shifting whatever frame-index bookkeeping the YouTube
// widget API relies on for postMessage routing — outside this file's
// control either way, so working around it beats chasing it further. The
// tradeoff is a brief audio gap on every switch instead of an instant
// crossfade — a real regression from the original "seamless" goal, but a
// working, correct player beats a seamless, silently-broken one.
async function recreatePlayer(video) {
  const YT = await loadYouTubeApi();
  if (ytPlayer && typeof ytPlayer.destroy === 'function') {
    ytPlayer.destroy();
    // A brief settle gap before creating the replacement — confirmed
    // directly this session that creating a new YT.Player in the exact same
    // tick as destroy()ing the previous one is unreliable (worked once,
    // then silently stalled mid-buffer on a second back-to-back cycle, even
    // though the same video plays instantly on youtube.com directly — not a
    // video-side issue). A real navigation would never do two of these in
    // the same frame either way, so this costs nothing in the common case.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const bar = root();
    const placeholder = document.createElement('div');
    placeholder.id = 'player-bar-yt';
    placeholder.className = 'player-bar-yt';
    bar.appendChild(placeholder);
  }
  // destroy() leaves no element behind — if a watch page is currently
  // showing the big player, the fresh placeholder needs the docked styling
  // applied immediately (not "whenever the next rAF frame happens to run"),
  // or there'd be a one-frame flash of the tiny/invisible mini styling.
  const ytEl = document.getElementById('player-bar-yt');
  if (dockTarget && ytEl) {
    ytEl.classList.add('docked-big');
    const rect = dockTarget.getBoundingClientRect();
    ytEl.style.left = `${rect.left}px`;
    ytEl.style.top = `${rect.top}px`;
    ytEl.style.width = `${rect.width}px`;
    ytEl.style.height = `${rect.height}px`;
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
      if (onEndedOverride) onEndedOverride();
      else advanceToNextInQueue();
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
