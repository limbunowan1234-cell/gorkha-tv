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

export function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function recordView(id) {
  fetch(`${API_BASE}/videos/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
}

// One category's titles. Magic is special: every magic upload so far is a
// Short (the long-form endpoints exclude Shorts by design), so its section
// combines long-form magic with the magic Shorts, newest first.
export async function fetchCategory(slug, limit = 16) {
  if (slug === 'magic') {
    const [long, shorts] = await Promise.all([
      apiFetch(`/videos?category=magic&limit=${limit}`).catch(() => ({ videos: [] })),
      apiFetch(`/shorts?category=magic&limit=${limit}`).catch(() => ({ shorts: [] })),
    ]);
    const seen = new Set();
    return [...(long.videos || []), ...(shorts.shorts || []).map((v) => ({ ...v, isShort: true }))]
      .filter((v) => !seen.has(v.youtube_video_id) && seen.add(v.youtube_video_id))
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  }
  const { videos } = await apiFetch(`/videos?category=${slug}&limit=${limit}&sort=popular`).catch(() => ({ videos: [] }));
  return videos || [];
}
