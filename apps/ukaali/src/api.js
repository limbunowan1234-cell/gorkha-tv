const API_BASE = 'https://gorkhatv.site/api';

export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function ytThumb(v) {
  if (v.thumbnail_url) return v.thumbnail_url;
  return `https://img.youtube.com/vi/${v.youtube_video_id}/hqdefault.jpg`;
}

export function formatCount(n) {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Same personalization signal the website's Shorts feed sends
// (functions/api/shorts/event.js) — fire-and-forget, never blocks playback.
export function postShortsEvent(item, eventType) {
  fetch(`${API_BASE}/shorts/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      youtubeVideoId: item.youtube_video_id,
      category: item.category,
      channelId: item.youtube_channel_id,
      eventType,
    }),
  }).catch(() => {});
}

export function recordView(id) {
  fetch(`${API_BASE}/videos/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
}
