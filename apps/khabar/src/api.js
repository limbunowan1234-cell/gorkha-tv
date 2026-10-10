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

// "12m ago", "3h ago", "2d ago", then a plain date: news is about when.
export function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Fresh means under 6 hours old: that is what earns a BREAKING tag.
export function isFresh(iso) {
  return !!iso && Date.now() - new Date(iso).getTime() < 6 * 3600 * 1000;
}

export function recordView(id) {
  fetch(`${API_BASE}/videos/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
}

// Newest news first. `location` narrows to one town.
export async function fetchNews({ location, limit = 30 } = {}) {
  const qs = ['category=news', 'sort=latest', `limit=${limit}`, location ? `location=${encodeURIComponent(location)}` : ''].filter(Boolean).join('&');
  const { videos } = await apiFetch(`/videos?${qs}`);
  return videos || [];
}

// Search is site-wide on the server; KHABAR only shows news results.
export async function searchNews(q) {
  const { videos } = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
  return (videos || []).filter((v) => v.category === 'news');
}
