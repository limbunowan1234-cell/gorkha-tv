// GorkhaTV Beats' "Up Next" queue — a real, visible playlist behind
// whatever track a viewer clicked (from the Top 100 chart or a Beats Top 10
// row), not just the single-video autoplay-overlay js/watch.js already had.
//
// Same gtv_*-prefixed, sessionStorage, try/catch-best-effort idiom as
// js/watch.js's existing AUTOPLAY_HISTORY_KEY — a real page navigation
// still tears down every other bit of JS state, so sessionStorage (survives
// navigation within a tab, cleared on tab close) is the only thing that
// can carry "what list was I playing from" across that navigation. This is
// deliberately a separate concern from AUTOPLAY_HISTORY_KEY (which is just
// a "don't replay this" dedupe set) — the queue is an ordered list + a
// position in it.
const QUEUE_STORAGE_KEY = 'gtv_queue';

function readQueue() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(QUEUE_STORAGE_KEY));
    if (raw && Array.isArray(raw.items) && typeof raw.index === 'number') return raw;
  } catch {
    /* fall through */
  }
  return null;
}

function writeQueue(state) {
  try {
    sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* best-effort — worst case the queue just doesn't survive navigation */
  }
}

// Called at the moment a viewer clicks a track in a list (chart row, Beats
// Top 10 card) — `items` is the full list they clicked from, `startIndex`
// is which one they clicked.
export function setQueue(items, startIndex) {
  writeQueue({ items, index: startIndex });
}

export function getQueue() {
  return readQueue();
}

// The video actually playing right now, per the stored queue position —
// null if there's no active queue.
export function currentQueueItem() {
  const q = readQueue();
  return q ? q.items[q.index] || null : null;
}

// What "up next" should show/advance to — the rest of the queue after the
// current position, in order.
export function upcomingQueueItems() {
  const q = readQueue();
  return q ? q.items.slice(q.index + 1) : [];
}

// Call when a track actually starts playing (i.e. the watch page for that
// video has loaded) so the stored position tracks reality — matters when a
// viewer skips ahead in the "Up Next" list rather than just letting one
// track end into the next. Returns whether the current video actually
// belongs to the stored queue at all — a viewer who wandered off to an
// unrelated related-video click shouldn't have a stale queue's "Up Next"
// list shown as if it still applied to what they're watching now.
export function syncQueuePosition(youtubeVideoId) {
  const q = readQueue();
  if (!q) return false;
  const idx = q.items.findIndex((v) => v.youtube_video_id === youtubeVideoId);
  if (idx === -1) return false;
  if (idx !== q.index) writeQueue({ items: q.items, index: idx });
  return true;
}

export function clearQueue() {
  try {
    sessionStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
