import { apiFetch, escapeHtml, videoCardHTML, showToast, formatCount } from './api.js';
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
    initFollowButton(creator);
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
      <div class="creator-stats"><span id="follower-count" data-count="${c.followerCount}">${formatCount(c.followerCount)}</span> follower${c.followerCount === 1 ? '' : 's'}</div>
      ${c.description ? `<p class="creator-desc">${escapeHtml(c.description)}</p>` : ''}
      <div class="creator-actions">
        <button class="follow-btn" id="follow-btn"></button>
        ${c.channel_url ? `<a class="creator-yt-link" href="${escapeHtml(c.channel_url)}" target="_blank" rel="noopener">▶ Visit Channel on YouTube</a>` : ''}
      </div>
      <div class="claim-box" id="claim-box"></div>
    </div>`;

  const grid = document.getElementById('creator-videos');
  grid.innerHTML = videos.length
    ? videos.map(videoCardHTML).join('')
    : `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">📭</div><h3>No published videos yet</h3></div>`;
}

async function initFollowButton(c) {
  const btn = document.getElementById('follow-btn');
  if (!btn) return;

  if (!getCurrentUser()) {
    setFollowButtonState(btn, false);
    btn.onclick = () => showToast('Sign in to follow creators');
    return;
  }

  let isFollowing = false;
  try {
    const { follows } = await apiFetch('/follows');
    isFollowing = follows.some((f) => f.id === c.id);
  } catch {
    /* nice-to-have, button still works without it */
  }
  setFollowButtonState(btn, isFollowing);

  btn.onclick = async () => {
    try {
      if (isFollowing) {
        await fetch(`/api/follows/${encodeURIComponent(c.id)}`, { method: 'DELETE', credentials: 'include' });
        isFollowing = false;
        bumpFollowerCount(-1);
        showToast('Unfollowed');
      } else {
        await fetch('/api/follows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ channelId: c.id }),
        });
        isFollowing = true;
        bumpFollowerCount(1);
        showToast('Following ✓');
      }
      setFollowButtonState(btn, isFollowing);
    } catch {
      showToast('Something went wrong — please try again.');
    }
  };
}

function setFollowButtonState(btn, isFollowing) {
  btn.textContent = isFollowing ? '✓ Following' : '+ Follow';
  btn.classList.toggle('following', isFollowing);
}

// Optimistic local update — the follower count came from a 120s-cached
// response, so it won't reflect this click server-side for up to 2 minutes.
// Tracks the raw number in data-count (not parsed back out of the formatted
// "1.2K"-style text, which would lose precision).
function bumpFollowerCount(delta) {
  const el = document.getElementById('follower-count');
  if (!el) return;
  const next = Math.max(0, (parseInt(el.dataset.count, 10) || 0) + delta);
  el.dataset.count = next;
  el.textContent = formatCount(next);
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
