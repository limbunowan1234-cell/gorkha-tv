import { apiFetch, ytThumb, watchUrl, formatViews, escapeHtml } from './api.js';
import { initAuthNav } from './auth.js';
import { setQueue } from './queue.js';

let chartItems = [];

async function init() {
  initAuthNav();
  const list = document.getElementById('chart-list');
  try {
    const { chart } = await apiFetch('/chart');
    if (!chart.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">🎵</div><h3>No chart data yet</h3><p>Check back once more music has synced.</p></div>`;
      return;
    }
    chartItems = chart;
    list.innerHTML = chart.map((v, i) => chartRowHTML(v, i + 1)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>Couldn't load the chart</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// Real <a href> (works with no JS, middle-click, share links, etc.) — the
// queue is seeded by a plain click listener that runs synchronously before
// the browser's own navigation, same trick used sitewide for "real link
// first, JS enhancement on top" rather than intercepting the click.
document.getElementById('chart-list')?.addEventListener('click', (e) => {
  const row = e.target.closest('.chart-row');
  if (!row) return;
  const index = Number(row.dataset.index);
  if (Number.isInteger(index)) setQueue(chartItems, index);
});

function chartRowHTML(v, rank) {
  const thumb = ytThumb(v);
  const sub = [v.channel_name, v.view_count ? formatViews(v.view_count) : null].filter(Boolean).join(' · ');
  return `
    <a class="chart-row" href="${watchUrl(v, { autoplay: true })}" data-index="${rank - 1}">
      <div class="chart-rank">${rank}</div>
      <div class="chart-thumb"><img src="${escapeHtml(thumb)}" loading="lazy" alt="" onerror="this.src='https://img.youtube.com/vi/${escapeHtml(v.youtube_video_id)}/default.jpg'"></div>
      <div class="chart-info">
        <div class="chart-row-title">${escapeHtml(v.title)}</div>
        <div class="chart-row-sub">${escapeHtml(sub)}</div>
      </div>
    </a>`;
}

init();
