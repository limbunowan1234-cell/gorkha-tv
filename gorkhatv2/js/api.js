// Centralized fetch helper for the public /api/* routes, used by every
// public page (home, browse, search, watch, creator). Replaces the old
// per-page inline Appwrite imports with one small shared client.

const API_BASE = '/api';

export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function ytThumb(video) {
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.youtube_video_id) return `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
  return '';
}

export function watchUrl(video) {
  return `/watch/${video.youtube_video_id}`;
}

// Channels' canonical URL is their root-level slug — falls back to the old
// /creator/:id form (which 301s to the slug) if a given API response ever
// doesn't include one, so a stale cached payload never produces a dead link.
export function creatorUrl(creator) {
  return creator.slug ? `/${creator.slug}` : `/creator/${creator.youtube_channel_id}`;
}

export function categoryUrl(slug) {
  return `/category/${encodeURIComponent(slug)}`;
}

export function locationUrl(loc) {
  return `/location/${encodeURIComponent(loc)}`;
}

// Bare abbreviated number (12.3K, 1.2M) — no unit suffix, for contexts like
// a like-count badge where "views"/"likes" is implied by an adjacent icon.
export function formatCount(n) {
  if (!n) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function formatViews(n) {
  if (!n) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${n} view${n === 1 ? '' : 's'}`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function videoCardHTML(v) {
  const thumb = ytThumb(v);
  return `
    <div class="card" onclick="window.location.href='${watchUrl(v)}'">
      <div class="card-thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || '')}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(v.youtube_video_id)}/default.jpg'">
        <div class="card-play-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        ${v.category ? `<span class="card-cat-badge">${escapeHtml(v.category)}</span>` : ''}
        ${v.view_count ? `<span class="card-like-count">${escapeHtml(formatViews(v.view_count))}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(v.title || '')}</div>
        <div class="card-sub">${escapeHtml(v.channel_name || '')}${v.location ? ' · ' + escapeHtml(v.location) : ''}</div>
      </div>
    </div>`;
}

// "Continue Watching" card — same .card shape as videoCardHTML plus a thin
// progress-bar overlay on the thumbnail (functions/api/home/personalized.js
// supplies progress_seconds/duration_seconds per item).
export function continueWatchingCardHTML(v) {
  const thumb = ytThumb(v);
  const pct = v.duration_seconds ? Math.min(100, Math.round((v.progress_seconds / v.duration_seconds) * 100)) : 0;
  return `
    <div class="card" onclick="window.location.href='${watchUrl(v)}'">
      <div class="card-thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || '')}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(v.youtube_video_id)}/default.jpg'">
        <div class="card-play-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        <div class="card-progress-track"><div class="card-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(v.title || '')}</div>
        <div class="card-sub">${escapeHtml(v.channel_name || '')}${v.location ? ' · ' + escapeHtml(v.location) : ''}</div>
      </div>
    </div>`;
}

// Netflix-style "Top 10" numbered row — .num-card/.num-big/.num-card-img
// already existed in style.css from the original design shell but were
// never wired up to real rendering until now. Used for the genuinely-ranked
// rows (see functions/api/home.js's Top 10 rework) — rank is 1-indexed.
export function numberedCardHTML(v, rank) {
  const thumb = ytThumb(v);
  return `
    <div class="num-card" onclick="window.location.href='${watchUrl(v)}'">
      <div class="num-big">${rank}</div>
      <div class="num-card-img">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || '')}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(v.youtube_video_id)}/default.jpg'">
      </div>
    </div>`;
}

export function creatorCardHTML(c) {
  const thumb = c.thumbnail_url || '';
  return `
    <div class="card" onclick="window.location.href='${creatorUrl(c)}'">
      <div class="card-thumb" style="background:var(--surface2);">
        ${thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(c.channel_name)}" loading="lazy">` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(c.channel_name || '')}</div>
        <div class="card-sub">${escapeHtml(c.category || '')}${c.location ? ' · ' + escapeHtml(c.location) : ''}</div>
      </div>
    </div>`;
}

export function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}
window.showToast = showToast;
