import { apiFetch, ytThumb, watchUrl, creatorUrl, formatViews, escapeHtml, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';
import { loadYouTubeApi } from './youtubeApi.js';
import { initComments } from './comments.js';
import { syncQueuePosition, upcomingQueueItems } from './queue.js';
import { registerTeardown, navigate } from './router.js';
import { playTrack, dockInto, undockToMini, setOnEndedHandler } from './playerBar.js';

// Product accent colors — same values as js/genres.js / functions/genre/
// [slug].js's GENRE_CONFIG, duplicated here per this codebase's existing
// convention of small constants living per-file rather than a shared
// import for a handful of color values.
const BEATS_COLOR = '#E6479D'; // SWARA (Raga Pink)
const CHIMAL_COLOR = '#E8A62A'; // Cinema Amber
const KHABAR_COLOR = '#3183F2'; // Signal Blue
// Sitewide default --red (css/style.css's :root) — duplicated here per this
// codebase's small-per-file-constant convention, same as the above.
const DEFAULT_RED = '#E63946';

// Every CHIMAL-absorbed category (see js/genres.js's GENRES[0].categories)
// maps to the 'chimal' brand; everything else falls through to its own
// category name (only 'news'/'music' actually match a known brand below —
// any other value lands on the 'gorkhatv' default, same as today).
const CATEGORY_BRAND = {
  movies: 'chimal', shortfilms: 'chimal', comedy: 'chimal', entertainment: 'chimal', vlogs: 'chimal', magic: 'chimal',
  news: 'khabar',
  music: 'swara',
};

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
    // video) — always registered unconditionally, same as the timers above.
    // Stops the CSS-position sync loop and resets the iframe to its normal
    // tiny mini-bar styling; the iframe was never a descendant of
    // #page-content in the first place (see playerBar.js's header comment),
    // so this is cleanup, not a survival requirement.
    undockToMini();
    // Hands ended-track handling back to playerBar.js's own default
    // (immediate advance, no countdown UI) — correct the instant this page
    // is no longer showing the big player to put a countdown overlay over.
    setOnEndedHandler(null);
  });

  await initAuthNav();

  const id = getVideoIdFromPath();
  if (!id) return renderNotFound();

  addToAutoplayHistory(id);
  queueActive = syncQueuePosition(id);

  try {
    const { video } = await apiFetch(`/videos/${encodeURIComponent(id)}`);
    currentVideo = video;
    const brand = renderVideo(video);
    renderKeyArt(video, brand); // no-op for every brand except chimal/khabar
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
      // dockInto() just starts a CSS-position sync loop over this slot — the
      // iframe itself never moves in the DOM (see playerBar.js's header
      // comment for why that matters), so there's no meaningful ordering
      // constraint against playTrack() here.
      dockInto('watch-player');
      await playTrack(video);
      // Same YouTube-style "up next" countdown regular videos already get
      // (maybeShowAutoplayOverlay(), completely unchanged) — it already
      // prefers the shared queue over relatedVideos, so this just needed
      // triggering on ENDED, which playerBar.js's own player now defers to
      // this page for while it's the one showing the big player.
      setOnEndedHandler(() => maybeShowAutoplayOverlay());
    } else {
      initPlayer(video);
    }
  } catch (err) {
    renderNotFound();
  }
}

// Brief loading placeholder for the big player slot — dockInto() (see
// js/playerBar.js) visually covers this exact element with the persistent
// bar's own live iframe via position:fixed coordinates once it's ready; the
// iframe itself always stays a child of #player-bar-root, never a
// descendant of this mount, so this placeholder is purely cosmetic filler
// for the brief gap before that overlay positions itself.
function renderBeatsPlayerArea(v) {
  const mount = document.getElementById('watch-player');
  if (!mount) return;
  mount.innerHTML = `<img src="${escapeHtml(ytThumb(v))}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
}

const BRAND_ACCENT = { chimal: CHIMAL_COLOR, khabar: KHABAR_COLOR, swara: BEATS_COLOR, gorkhatv: DEFAULT_RED };

// Every product gets its own watch-page chrome (SWARA's existing Spotify-
// style "now playing" treatment, CHIMAL's cinematic key-art + amber frame,
// KHABAR's breaking-news bar + blue frame) — same --red retinting trick
// js/genre.js already uses for the genre pages, so each reads as the same
// brand rather than a one-off. Always sets --red (to the matched product's
// accent, or back to the sitewide default) rather than only ever
// overriding it — since the router (js/router.js) can land here right
// after a differently-themed page, and <html> itself is never swapped, a
// video outside every known brand needs this to actively reset the theme,
// not just skip touching it.
function applyProductChrome(v) {
  const brand = CATEGORY_BRAND[v.category] || 'gorkhatv';
  const wrap = document.querySelector('.watch-wrap');
  wrap?.classList.remove('beats-mode', 'chimal-mode', 'khabar-mode');
  if (brand === 'swara') wrap?.classList.add('beats-mode');
  else if (brand === 'chimal') wrap?.classList.add('chimal-mode');
  else if (brand === 'khabar') wrap?.classList.add('khabar-mode');
  document.documentElement.style.setProperty('--red', BRAND_ACCENT[brand]);
  document.documentElement.dataset.brand = brand;
  document.documentElement.style.setProperty('--terrace-pattern', `url(/patterns/${brand}-terrace-pattern.svg)`);
  const pill = document.getElementById('watch-eyebrow-pill');
  if (pill) pill.textContent = brand === 'chimal' ? 'CHIMAL' : brand === 'khabar' ? 'KHABAR' : '';
  return brand;
}

// Real vector art from the Gorkha TV Brand Pack (01-symbols/*-symbol.svg —
// same source js/loader.js's LOADER_SVG already copies verbatim), with
// colors inlined directly rather than through --brand-accent/tokens.css's
// .mark/.s/.f classes: this is a static one-off watermark on the key-art
// overlay below, not the animated loader those classes are built for.
const KEYART_MARK = {
  chimal: `<svg class="keyart-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M25.69 61.02 L25.56 61.20 L25.49 61.29 L24.94 62.08 L24.87 62.18 L24.34 62.98 L24.28 63.08 L23.79 63.90 L23.73 64.01 L23.26 64.84 L23.20 64.94 L22.77 65.78 L22.72 65.89 L22.32 66.74 L22.27 66.85 L21.90 67.70 L21.85 67.82 L21.52 68.67 L21.48 68.79 L21.18 69.64 L21.14 69.76 L20.88 70.61 L20.84 70.74 L20.62 71.59 L20.58 71.72 L20.40 72.55 L20.37 72.69 L20.22 73.51 L20.20 73.66 L20.08 74.46 L20.07 74.61 L19.99 75.41 L19.98 75.56 L19.94 76.33 L19.93 76.49 L19.93 77.25 L19.93 77.41 L19.96 78.14 L19.97 78.31 L20.03 79.02 L20.05 79.20 L20.15 79.87 L20.18 80.05 L20.31 80.70 L20.35 80.89 L20.51 81.51 L20.56 81.70 L20.75 82.28 L20.82 82.48 L21.03 83.03 L21.11 83.23 L21.35 83.75 L21.45 83.95 L21.71 84.43 L21.82 84.63 L22.10 85.09 L22.23 85.28 L22.54 85.70 L22.68 85.89 L23.01 86.28 L23.17 86.46 L23.51 86.82 L23.69 87.00 L24.05 87.32 L24.24 87.49 L24.63 87.78 L24.83 87.93 L25.23 88.20 L25.45 88.34 L25.87 88.58 L26.09 88.69 L26.54 88.91 L26.76 89.01 L27.23 89.19 L27.46 89.28 L27.95 89.43 L28.18 89.50 L28.69 89.63 L28.92 89.67 L29.46 89.77 L29.68 89.80 L30.25 89.87 L30.46 89.89 L31.05 89.92 L31.26 89.92 L31.87 89.92 L32.07 89.91 L32.71 89.87 L32.90 89.85 L33.55 89.77 L33.74 89.74 L34.41 89.63 L34.59 89.59 L35.28 89.43 L35.44 89.39 L36.14 89.19 L36.30 89.15 L37.02 88.91 L37.17 88.85 L37.89 88.58 L38.03 88.52 L38.77 88.20 L38.90 88.14 L39.64 87.78 L39.76 87.71 L40.50 87.32 L40.62 87.25 L41.36 86.81 L41.47 86.74 L42.21 86.27 L42.32 86.19 L43.04 85.68 L43.15 85.60 L43.87 85.06 L43.97 84.98 L44.68 84.40 L44.77 84.32 L45.47 83.71 L45.56 83.62 L46.24 82.98 L46.33 82.90 L46.99 82.23 L47.08 82.14 L47.72 81.44 L47.80 81.35 L48.43 80.63 L48.50 80.54 L49.11 79.79 L49.18 79.70 L49.76 78.93 L49.83 78.83 L49.95 78.65 L50.00 78.59 L50.05 78.65 L50.17 78.83 L50.24 78.93 L50.82 79.70 L50.89 79.79 L51.50 80.54 L51.57 80.63 L52.20 81.35 L52.28 81.44 L52.92 82.14 L53.01 82.23 L53.67 82.90 L53.76 82.98 L54.44 83.62 L54.53 83.71 L55.23 84.32 L55.32 84.40 L56.03 84.98 L56.13 85.06 L56.85 85.60 L56.96 85.68 L57.68 86.19 L57.79 86.27 L58.53 86.74 L58.64 86.81 L59.38 87.25 L59.50 87.32 L60.24 87.71 L60.36 87.78 L61.10 88.14 L61.23 88.20 L61.97 88.52 L62.11 88.58 L62.83 88.85 L62.98 88.91 L63.70 89.15 L63.86 89.19 L64.56 89.39 L64.72 89.43 L65.41 89.59 L65.59 89.63 L66.26 89.74 L66.45 89.77 L67.10 89.85 L67.29 89.87 L67.93 89.91 L68.13 89.92 L68.74 89.92 L68.95 89.92 L69.54 89.89 L69.75 89.87 L70.32 89.80 L70.54 89.77 L71.08 89.67 L71.31 89.63 L71.82 89.50 L72.05 89.43 L72.54 89.28 L72.77 89.19 L73.24 89.01 L73.46 88.91 L73.91 88.69 L74.13 88.58 L74.55 88.34 L74.77 88.20 L75.17 87.93 L75.37 87.78 L75.76 87.49 L75.95 87.32 L76.31 87.00 L76.49 86.82 L76.83 86.46 L76.99 86.28 L77.32 85.89 L77.46 85.70 L77.77 85.28 L77.90 85.09 L78.18 84.63 L78.29 84.43 L78.55 83.95 L78.65 83.75 L78.89 83.23 L78.97 83.03 L79.18 82.48 L79.25 82.28 L79.44 81.70 L79.49 81.51 L79.65 80.89 L79.69 80.70 L79.82 80.05 L79.85 79.87 L79.95 79.20 L79.97 79.02 L80.03 78.31 L80.04 78.14 L80.07 77.41 L80.07 77.25 L80.07 76.49 L80.06 76.33 L80.02 75.56 L80.01 75.41 L79.93 74.61 L79.92 74.46 L79.80 73.66 L79.78 73.51 L79.63 72.69 L79.60 72.55 L79.42 71.72 L79.38 71.59 L79.16 70.74 L79.12 70.61 L78.86 69.76 L78.82 69.64 L78.52 68.79 L78.48 68.67 L78.15 67.82 L78.10 67.70 L77.73 66.85 L77.68 66.74 L77.28 65.89 L77.23 65.78 L76.80 64.94 L76.74 64.84 L76.27 64.01 L76.21 63.90 L75.72 63.08 L75.66 62.98 L75.13 62.18 L75.06 62.08 L74.51 61.29 L74.44 61.20 L74.31 61.02 L74.27 60.96 L74.34 60.93 L74.55 60.87 L74.66 60.83 L75.57 60.52 L75.68 60.48 L76.58 60.14 L76.69 60.09 L77.57 59.72 L77.68 59.67 L78.55 59.27 L78.65 59.22 L79.50 58.80 L79.61 58.74 L80.43 58.29 L80.53 58.23 L81.33 57.76 L81.44 57.69 L82.21 57.20 L82.31 57.13 L83.05 56.61 L83.16 56.53 L83.87 56.00 L83.97 55.92 L84.65 55.37 L84.76 55.28 L85.40 54.72 L85.50 54.62 L86.11 54.04 L86.21 53.94 L86.78 53.35 L86.88 53.24 L87.41 52.65 L87.51 52.53 L87.99 51.93 L88.09 51.80 L88.54 51.19 L88.63 51.06 L89.04 50.45 L89.13 50.31 L89.49 49.70 L89.58 49.54 L89.90 48.94 L89.98 48.77 L90.26 48.18 L90.34 48.00 L90.57 47.41 L90.64 47.22 L90.84 46.64 L90.90 46.44 L91.05 45.87 L91.10 45.66 L91.21 45.10 L91.25 44.88 L91.32 44.33 L91.35 44.11 L91.39 43.57 L91.40 43.34 L91.40 42.82 L91.39 42.58 L91.36 42.08 L91.33 41.83 L91.27 41.34 L91.22 41.10 L91.12 40.62 L91.06 40.37 L90.93 39.91 L90.85 39.67 L90.69 39.21 L90.59 38.98 L90.39 38.53 L90.28 38.31 L90.05 37.87 L89.92 37.66 L89.65 37.24 L89.52 37.04 L89.21 36.62 L89.07 36.43 L88.72 36.03 L88.57 35.85 L88.19 35.46 L88.03 35.30 L87.61 34.92 L87.45 34.78 L86.99 34.40 L86.82 34.28 L86.32 33.92 L86.15 33.81 L85.62 33.47 L85.45 33.37 L84.88 33.05 L84.71 32.97 L84.10 32.67 L83.93 32.59 L83.28 32.31 L83.12 32.25 L82.44 32.00 L82.28 31.94 L81.57 31.71 L81.41 31.67 L80.66 31.47 L80.51 31.43 L79.74 31.26 L79.59 31.23 L78.78 31.09 L78.64 31.07 L77.81 30.96 L77.67 30.94 L76.82 30.86 L76.68 30.85 L75.81 30.80 L75.68 30.80 L74.79 30.78 L74.66 30.78 L73.76 30.80 L73.63 30.81 L72.72 30.86 L72.59 30.87 L71.67 30.95 L71.55 30.97 L70.62 31.09 L70.50 31.10 L69.57 31.26 L69.45 31.28 L68.52 31.46 L68.40 31.49 L67.47 31.71 L67.35 31.74 L66.43 31.99 L66.31 32.02 L65.39 32.30 L65.28 32.34 L65.07 32.41 L65.00 32.43 L65.00 32.35 L65.00 32.13 L65.00 32.02 L64.98 31.05 L64.98 30.94 L64.93 29.98 L64.92 29.86 L64.84 28.90 L64.83 28.79 L64.72 27.84 L64.70 27.72 L64.56 26.79 L64.54 26.67 L64.37 25.75 L64.34 25.63 L64.14 24.72 L64.11 24.60 L63.87 23.72 L63.84 23.59 L63.58 22.73 L63.54 22.61 L63.25 21.77 L63.20 21.64 L62.89 20.83 L62.84 20.70 L62.50 19.92 L62.44 19.79 L62.08 19.03 L62.01 18.90 L61.63 18.18 L61.56 18.05 L61.15 17.37 L61.07 17.23 L60.65 16.58 L60.56 16.45 L60.12 15.84 L60.02 15.71 L59.57 15.14 L59.46 15.00 L58.99 14.47 L58.87 14.34 L58.40 13.85 L58.27 13.72 L57.78 13.27 L57.64 13.14 L57.15 12.74 L56.99 12.61 L56.50 12.25 L56.33 12.13 L55.83 11.81 L55.65 11.70 L55.15 11.41 L54.95 11.31 L54.46 11.07 L54.25 10.98 L53.75 10.78 L53.53 10.70 L53.04 10.53 L52.81 10.47 L52.32 10.34 L52.08 10.29 L51.59 10.20 L51.35 10.17 L50.86 10.11 L50.61 10.10 L50.13 10.08 L49.87 10.08 L49.39 10.10 L49.14 10.11 L48.65 10.17 L48.41 10.20 L47.92 10.29 L47.68 10.34 L47.19 10.47 L46.96 10.53 L46.47 10.70 L46.25 10.78 L45.75 10.98 L45.54 11.07 L45.05 11.31 L44.85 11.41 L44.35 11.70 L44.17 11.81 L43.67 12.13 L43.50 12.25 L43.01 12.61 L42.85 12.74 L42.36 13.14 L42.22 13.27 L41.73 13.72 L41.60 13.85 L41.13 14.34 L41.01 14.47 L40.54 15.00 L40.43 15.14 L39.98 15.71 L39.88 15.84 L39.44 16.45 L39.35 16.58 L38.93 17.23 L38.85 17.37 L38.44 18.05 L38.37 18.18 L37.99 18.90 L37.92 19.03 L37.56 19.79 L37.50 19.92 L37.16 20.70 L37.11 20.83 L36.80 21.64 L36.75 21.77 L36.46 22.61 L36.42 22.73 L36.16 23.59 L36.13 23.72 L35.89 24.60 L35.86 24.72 L35.66 25.63 L35.63 25.75 L35.46 26.67 L35.44 26.79 L35.30 27.72 L35.28 27.84 L35.17 28.79 L35.16 28.90 L35.08 29.86 L35.07 29.98 L35.02 30.94 L35.02 31.05 L35.00 32.02 L35.00 32.13 L35.00 32.35 L35.00 32.43 L34.93 32.41 L34.72 32.34 L34.61 32.30 L33.69 32.02 L33.57 31.99 L32.65 31.74 L32.53 31.71 L31.60 31.49 L31.48 31.46 L30.55 31.28 L30.43 31.26 L29.50 31.10 L29.38 31.09 L28.45 30.97 L28.33 30.95 L27.41 30.87 L27.28 30.86 L26.37 30.81 L26.24 30.80 L25.34 30.78 L25.21 30.78 L24.32 30.80 L24.19 30.80 L23.32 30.85 L23.18 30.86 L22.33 30.94 L22.19 30.96 L21.36 31.07 L21.22 31.09 L20.41 31.23 L20.26 31.26 L19.49 31.43 L19.34 31.47 L18.59 31.67 L18.43 31.71 L17.72 31.94 L17.56 32.00 L16.88 32.25 L16.72 32.31 L16.07 32.59 L15.90 32.67 L15.29 32.97 L15.12 33.05 L14.55 33.37 L14.38 33.47 L13.85 33.81 L13.68 33.92 L13.18 34.28 L13.01 34.40 L12.55 34.78 L12.39 34.92 L11.97 35.30 L11.81 35.46 L11.43 35.85 L11.28 36.03 L10.93 36.43 L10.79 36.62 L10.48 37.04 L10.35 37.24 L10.08 37.66 L9.95 37.87 L9.72 38.31 L9.61 38.53 L9.41 38.98 L9.31 39.21 L9.15 39.67 L9.07 39.91 L8.94 40.37 L8.88 40.62 L8.78 41.10 L8.73 41.34 L8.67 41.83 L8.64 42.08 L8.61 42.58 L8.60 42.82 L8.60 43.34 L8.61 43.57 L8.65 44.11 L8.68 44.33 L8.75 44.88 L8.79 45.10 L8.90 45.66 L8.95 45.87 L9.10 46.44 L9.16 46.64 L9.36 47.22 L9.43 47.41 L9.66 48.00 L9.74 48.18 L10.02 48.77 L10.10 48.94 L10.42 49.54 L10.51 49.70 L10.87 50.31 L10.96 50.45 L11.37 51.06 L11.46 51.19 L11.91 51.80 L12.01 51.93 L12.49 52.53 L12.59 52.65 L13.12 53.24 L13.22 53.35 L13.79 53.94 L13.89 54.04 L14.50 54.62 L14.60 54.72 L15.24 55.28 L15.35 55.37 L16.03 55.92 L16.13 56.00 L16.84 56.53 L16.95 56.61 L17.69 57.13 L17.79 57.20 L18.56 57.69 L18.67 57.76 L19.47 58.23 L19.57 58.29 L20.39 58.74 L20.50 58.80 L21.35 59.22 L21.45 59.27 L22.32 59.67 L22.43 59.72 L23.31 60.09 L23.42 60.14 L24.32 60.48 L24.43 60.52 L25.34 60.83 L25.45 60.87 L25.66 60.93 L25.73 60.96 Z M60.20 50.90 L60.41 51.04 L60.61 51.19 L60.79 51.37 L60.95 51.56 L61.09 51.77 L61.21 51.98 L61.31 52.22 L61.38 52.45 L61.43 52.70 L61.46 52.95 L61.46 53.20 L61.43 53.45 L61.38 53.69 L61.31 53.93 L61.21 54.16 L61.09 54.38 L60.95 54.59 L60.79 54.78 L60.61 54.95 L60.41 55.11 L60.20 55.24 L46.74 62.94 L46.52 63.05 L46.29 63.14 L46.05 63.21 L45.80 63.25 L45.55 63.27 L45.31 63.26 L45.06 63.23 L44.82 63.17 L44.58 63.09 L44.35 62.99 L44.14 62.86 L43.94 62.72 L43.75 62.55 L43.58 62.37 L43.43 62.17 L43.30 61.96 L43.20 61.74 L43.11 61.50 L43.05 61.26 L43.01 61.01 L43.00 60.77 L43.00 45.38 L43.01 45.13 L43.05 44.89 L43.11 44.65 L43.20 44.41 L43.30 44.19 L43.43 43.98 L43.58 43.78 L43.75 43.60 L43.94 43.43 L44.14 43.28 L44.35 43.16 L44.58 43.06 L44.82 42.98 L45.06 42.92 L45.31 42.89 L45.55 42.88 L45.80 42.90 L46.05 42.94 L46.29 43.01 L46.52 43.10 L46.74 43.21 Z" fill="#E8A62A" fill-rule="evenodd"/></svg>`,
  khabar: `<svg class="keyart-mark" viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(-0.50 0.50)"><path d="M28 18 L28 82" fill="none" stroke="#3183F2" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 50 L58 32" fill="none" stroke="#3183F2" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 50 L70 82" fill="none" stroke="#3183F2" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="70" cy="20" r="9" fill="#3183F2"/></g></svg>`,
};

// Brief branded "key art" moment shown over the player while it loads —
// CHIMAL gets a movie-poster-style scrim/title treatment, KHABAR a
// breaking-news bar — matching (not literally reproducing; the real
// templates are a 2:3 poster and a 16:9 card respectively, this player
// slot is always 16:9) the Gorkha TV Brand Pack's own 10-social templates
// for these two products. SWARA already gets an equivalent moment via
// renderBeatsPlayerArea()'s thumbnail + playerBar.js's dock sequence, and
// every other category keeps today's plain player with no key art at all.
function renderKeyArt(v, brand) {
  if (brand !== 'chimal' && brand !== 'khabar') return;
  const wrap = document.querySelector('.watch-player-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'watch-keyart';
  el.id = 'watch-keyart';
  el.style.backgroundImage = `url(${escapeHtml(ytThumb(v))})`;
  el.innerHTML =
    brand === 'chimal'
      ? `<div class="keyart-scrim"></div>
         <div class="keyart-chimal-body">
           <div class="keyart-eyebrow">CHIMAL</div>
           <div class="keyart-title">${escapeHtml(v.title)}</div>
           <div class="keyart-byline">Only on CHIMAL${v.category ? ` · ${escapeHtml(v.category)}` : ''}</div>
         </div>
         ${KEYART_MARK.chimal}`
      : `<div class="keyart-khabar-bar">
           <div class="keyart-khabar-tag">BREAKING</div>
           <div class="keyart-title">${escapeHtml(v.title)}</div>
         </div>
         ${KEYART_MARK.khabar}`;
  wrap.appendChild(el);
}

// Fades and removes the key-art overlay once the player is interactable —
// a fixed delay rather than waiting for PLAYING, since a direct (non-
// autoplay) visit never reaches PLAYING on its own and would otherwise
// leave the key art covering a perfectly usable, just-not-yet-clicked
// player forever.
function hideKeyArt() {
  const el = document.getElementById('watch-keyart');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 650);
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
        setTimeout(hideKeyArt, 1200); // no-op if this video's brand never got one (renderKeyArt's own no-op case)
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
  const brand = applyProductChrome(v);

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
  return brand;
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
