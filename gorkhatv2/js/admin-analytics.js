import { initAdminPage, adminFetch, escapeHtml } from './admin-common.js';
import { renderLineChart } from './admin-chart.js';

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

async function loadAnalytics() {
  const grid = document.getElementById('stat-grid');
  try {
    const d = await adminFetch('/analytics');
    const stats = [
      { n: d.dau, l: 'Active sessions today (DAU)' },
      { n: d.mau, l: 'Monthly active sessions (30d)' },
      { n: d.newToday, l: 'New viewers today' },
      { n: d.returningToday, l: 'Returning viewers today' },
      { n: fmtDuration(d.watchTimeSeconds.today), l: 'Watch time today' },
      { n: fmtDuration(d.watchTimeSeconds.last7d), l: 'Watch time (7 days)' },
    ];
    grid.innerHTML = stats.map((s) => `<div class="stat-card"><div class="n">${escapeHtml(String(s.n))}</div><div class="l">${escapeHtml(s.l)}</div></div>`).join('');

    renderLineChart(
      document.getElementById('dau-chart'),
      d.dauTrend.map((r) => ({ c: r.c }))
    );
  } catch (err) {
    grid.innerHTML = `<div class="admin-empty">Couldn't load analytics: ${escapeHtml(err.message)}</div>`;
  }
}

initAdminPage(loadAnalytics);
