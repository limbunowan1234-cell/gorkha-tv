import { apiFetch, escapeHtml, videoCardHTML } from './api.js';
import { initAuthNav } from './auth.js';

function getChannelIdFromPath() {
  const match = window.location.pathname.match(/\/creator\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function init() {
  initAuthNav();
  const id = getChannelIdFromPath();
  if (!id) return renderNotFound();

  try {
    const { creator, videos } = await apiFetch(`/creators/${encodeURIComponent(id)}`);
    renderCreator(creator, videos);
  } catch {
    renderNotFound();
  }
}

function renderCreator(c, videos) {
  document.title = `${c.channel_name} | GorkhaTV`;

  const meta = [];
  if (c.category) meta.push(escapeHtml(c.category));
  if (c.location) meta.push(escapeHtml(c.location));
  if (c.channel_handle) meta.push(escapeHtml(c.channel_handle));

  document.getElementById('creator-hero').innerHTML = `
    ${c.thumbnail_url ? `<img src="${escapeHtml(c.thumbnail_url)}" alt="${escapeHtml(c.channel_name)}">` : `<div style="width:96px;height:96px;border-radius:50%;background:var(--surface2);"></div>`}
    <div>
      <div class="creator-name">${escapeHtml(c.channel_name)}${c.verified ? ' <span class="verified-tick" title="Verified">✓</span>' : ''}</div>
      <div class="creator-meta">${meta.join(' · ')}</div>
      ${c.description ? `<p class="creator-desc">${escapeHtml(c.description)}</p>` : ''}
      ${c.channel_url ? `<a class="creator-yt-link" href="${escapeHtml(c.channel_url)}" target="_blank" rel="noopener">▶ Visit Channel on YouTube</a>` : ''}
    </div>`;

  const grid = document.getElementById('creator-videos');
  grid.innerHTML = videos.length
    ? videos.map(videoCardHTML).join('')
    : `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">📭</div><h3>No published videos yet</h3></div>`;
}

function renderNotFound() {
  document.getElementById('creator-hero').innerHTML = `<div><div class="creator-name">Creator not found</div><p class="creator-desc">This creator may not be approved yet, or the link is incorrect.</p></div>`;
}

init();
