// Loads the YouTube IFrame Player API script once and resolves with the
// global `YT` object — shared by every page that creates YT.Player
// instances (shorts.js, feed.js, watch.js). Loaded lazily (not a static
// <script> tag) so it doesn't block the page, and so each caller controls
// exactly when player creation is allowed to start.
let ytApiPromise = null;

export function loadYouTubeApi() {
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
