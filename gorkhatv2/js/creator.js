import { apiFetch, escapeHtml, videoCardHTML, showToast } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';

let currentChannel = null;

function getChannelIdFromPath() {
  const match = window.location.pathname.match(/\/creator\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function init() {
  await initAuthNav();
  const id = getChannelIdFromPath();
  if (!id) return renderNotFound();

  try {
    const { creator, videos } = await apiFetch(`/creators/${encodeURIComponent(id)}`);
    currentChannel = creator;
    renderCreator(creator, videos);
    renderClaimBox(creator);
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
      <div class="claim-box" id="claim-box"></div>
    </div>`;

  const grid = document.getElementById('creator-videos');
  grid.innerHTML = videos.length
    ? videos.map(videoCardHTML).join('')
    : `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">📭</div><h3>No published videos yet</h3></div>`;
}

function renderClaimBox(c) {
  const box = document.getElementById('claim-box');
  if (!box || c.claimed) return; // already has an owner — nothing to show

  box.innerHTML = `
    <button class="claim-btn" id="claim-toggle-btn">🎬 Is this your channel? Claim it</button>
    <div class="claim-form" id="claim-form" style="display:none;">
      <textarea id="claim-message" rows="2" maxlength="1000" placeholder="Optional: how can we verify this is you? (e.g. a link, contact info)"></textarea>
      <button class="claim-btn" id="claim-submit-btn">Submit Claim</button>
      <div style="color:var(--muted);font-size:12px;margin-top:6px;" id="claim-status-msg"></div>
    </div>`;

  document.getElementById('claim-toggle-btn').addEventListener('click', () => {
    if (!getCurrentUser()) {
      showToast('Sign in to claim this channel');
      return;
    }
    document.getElementById('claim-form').style.display = 'block';
    document.getElementById('claim-toggle-btn').style.display = 'none';
  });

  document.getElementById('claim-submit-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('claim-status-msg');
    const btn = document.getElementById('claim-submit-btn');
    btn.disabled = true;
    msgEl.style.color = 'var(--muted)';
    msgEl.textContent = 'Submitting…';
    try {
      const res = await fetch('/api/creators/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channelId: c.id, message: document.getElementById('claim-message').value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to submit claim.');

      document.getElementById('claim-form').innerHTML = `<p style="color:#4ade80;font-size:13px;">✓ Claim submitted — an admin will review it shortly.</p>`;
      showToast('Claim submitted for review');
    } catch (err) {
      msgEl.style.color = '#f87171';
      msgEl.textContent = err.message;
      btn.disabled = false;
    }
  });
}

function renderNotFound() {
  document.getElementById('creator-hero').innerHTML = `<div><div class="creator-name">Creator not found</div><p class="creator-desc">This creator may not be approved yet, or the link is incorrect.</p></div>`;
}

init();
