import { apiFetch, ytThumb, watchUrl, formatViews, escapeHtml } from './api.js';
import { initAuthNav } from './auth.js';

async function init() {
  initAuthNav();
  const list = document.getElementById('chart-list');
  try {
    const { chart } = await apiFetch('/chart');
    if (!chart.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">🎵</div><h3>No chart data yet</h3><p>Check back once more music has synced.</p></div>`;
      return;
    }
    list.innerHTML = chart.map((v, i) => chartRowHTML(v, i + 1)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>Couldn't load the chart</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function chartRowHTML(v, rank) {
  const thumb = ytThumb(v);
  const sub = [v.channel_name, v.view_count ? formatViews(v.view_count) : null].filter(Boolean).join(' · ');
  return `
    <div class="chart-row" onclick="window.location.href='${watchUrl(v)}'">
      <div class="chart-rank">${rank}</div>
      <div class="chart-thumb"><img src="${escapeHtml(thumb)}" loading="lazy" alt="" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(v.youtube_video_id)}/default.jpg'"></div>
      <div class="chart-info">
        <div class="chart-row-title">${escapeHtml(v.title)}</div>
        <div class="chart-row-sub">${escapeHtml(sub)}</div>
      </div>
    </div>`;
}

init();
