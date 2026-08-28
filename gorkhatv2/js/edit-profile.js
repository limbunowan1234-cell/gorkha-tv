import { apiFetch, escapeHtml, showToast, formatCount } from './api.js';
import { initAuthNav, getCurrentUser } from './auth.js';
import { renderLineChart } from './admin-chart.js';

let categories = [];
let locations = [];

async function init() {
  await initAuthNav();
  const user = getCurrentUser();

  if (!user) {
    document.getElementById('signin-gate').style.display = 'block';
    return;
  }

  document.getElementById('profile-content').style.display = 'block';
  document.getElementById('display-name').value = user.displayName || '';
  document.getElementById('bio').value = user.bio || '';

  try {
    const [catRes, locRes] = await Promise.all([apiFetch('/categories'), apiFetch('/locations')]);
    categories = catRes.categories;
    locations = locRes.locations;
  } catch {
    /* selects degrade to text-only view if this fails */
  }

  wireProfileForm();
  loadChannels();
}

function wireProfileForm() {
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('profile-save-msg');
    msg.textContent = '';
    try {
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: document.getElementById('display-name').value,
          bio: document.getElementById('bio').value,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error('Failed to save.');
      });
      msg.textContent = 'Saved ✓';
      showToast('Profile updated');
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = '#f87171';
    }
  });
}

async function loadChannels() {
  const list = document.getElementById('channels-list');
  try {
    const { channels } = await apiFetch('/my/channels');
    if (!channels.length) {
      list.innerHTML = `<p class="text-muted">You haven't submitted a channel yet. <a href="submit-channel.html" style="color:var(--red);">Submit one →</a></p>`;
      return;
    }
    list.innerHTML = channels.map(channelItemHTML).join('');
    channels.forEach((c) => {
      wireChannelForm(c.id);
      if (c.status === 'approved') loadChannelAnalytics(c.id);
    });
  } catch (err) {
    list.innerHTML = `<p class="text-muted">Couldn't load your channels: ${escapeHtml(err.message)}</p>`;
  }
}

function channelItemHTML(c) {
  const catOptions = categories.map((cat) => `<option value="${cat.slug}" ${cat.slug === c.category ? 'selected' : ''}>${escapeHtml(cat.label)}</option>`).join('');
  const locOptions = locations.map((loc) => `<option value="${loc}" ${loc === c.location ? 'selected' : ''}>${loc}</option>`).join('');

  return `
    <div class="channel-item" data-channel-id="${c.id}">
      <div class="channel-item-header">
        ${c.thumbnail_url ? `<img src="${escapeHtml(c.thumbnail_url)}" alt="">` : ''}
        <div>
          <div class="channel-item-name">${escapeHtml(c.channel_name)}</div>
          <span class="badge badge-${c.status}">${c.status}</span>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Category</label>
          <select class="edit-category"><option value="">— none —</option>${catOptions}</select>
        </div>
        <div class="field">
          <label>Location</label>
          <select class="edit-location"><option value="">— none —</option>${locOptions}</select>
        </div>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea class="edit-description" rows="3" maxlength="2000">${escapeHtml(c.description || '')}</textarea>
      </div>
      <button type="button" class="btn btn-secondary btn-sm channel-save-btn">Save Channel</button>
      <div class="save-msg"></div>
      ${c.status === 'approved' ? `<div class="channel-analytics" id="analytics-${c.id}"><div class="admin-loading">Loading analytics…</div></div>` : ''}
    </div>`;
}

async function loadChannelAnalytics(channelId) {
  const box = document.getElementById(`analytics-${channelId}`);
  if (!box) return;
  try {
    const { analytics: a } = await apiFetch(`/my/channels/${encodeURIComponent(channelId)}/analytics`);
    box.innerHTML = `
      <div class="channel-stat-grid">
        <div class="channel-stat"><div class="n">${formatCount(a.totalViews)}</div><div class="l">Total views</div></div>
        <div class="channel-stat"><div class="n">${a.videoCount}</div><div class="l">Videos</div></div>
        <div class="channel-stat"><div class="n">${formatCount(a.totalLikes)}</div><div class="l">Total likes</div></div>
        <div class="channel-stat"><div class="n">${formatCount(a.avgViews)}</div><div class="l">Avg views / video</div></div>
      </div>
      ${
        a.topVideo
          ? `<div class="channel-top-video">
               <span class="l">Top video:</span> ${escapeHtml(a.topVideo.title)} — ${formatCount(a.topVideo.view_count)} views
             </div>`
          : ''
      }
      <div class="channel-trend-label">On-site views — last 7 days</div>
      <div id="trend-${channelId}"></div>`;
    renderLineChart(document.getElementById(`trend-${channelId}`), a.viewsTrend.map((r) => ({ c: r.views })), { height: 60 });
  } catch {
    box.innerHTML = ''; // analytics are a nice-to-have — the edit form above still works without them
  }
}

function wireChannelForm(channelId) {
  const item = document.querySelector(`.channel-item[data-channel-id="${channelId}"]`);
  if (!item) return;

  item.querySelector('.channel-save-btn').addEventListener('click', async () => {
    const msg = item.querySelector('.save-msg');
    msg.textContent = '';
    try {
      const res = await fetch(`/api/my/channels/${encodeURIComponent(channelId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: item.querySelector('.edit-category').value,
          location: item.querySelector('.edit-location').value,
          description: item.querySelector('.edit-description').value,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save.');
      }
      msg.style.color = '#4ade80';
      msg.textContent = 'Saved ✓';
      showToast('Channel updated');
    } catch (err) {
      msg.style.color = '#f87171';
      msg.textContent = err.message;
    }
  });
}

init();
