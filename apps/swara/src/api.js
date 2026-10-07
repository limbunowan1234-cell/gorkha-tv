// Plain fetch() client for gorkhatv.site's public API — no cookie handling,
// matching this app's confirmed v1 scope (anonymous, read-only browsing +
// real video playback only; see Phase S's own plan for what's deferred).
// Response shapes here were read directly from the actual functions/api/*
// source, not assumed — see that same plan section for the full catalog.
const API_BASE = 'https://gorkhatv.site/api';

export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  // Several endpoints (home, genre, chart) degrade to a 200 with an `error`
  // field on a partial DB failure rather than a non-200 status — but still
  // return their normal (empty) shape alongside it, so only throw when the
  // response looks like nothing usable came back at all.
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function ytThumb(video) {
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.youtube_video_id) return `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
  return null;
}

export function formatCount(n) {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
