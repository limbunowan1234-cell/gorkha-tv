import { initAdminPage, adminFetch, escapeHtml } from './admin-common.js';
import { renderLineChart } from './admin-chart.js';

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${seconds}s`;
}

function fmtNumber(n) {
  return n.toLocaleString();
}

// "▲ 12%" / "▼ 8%" / "— flat", or nothing at all when there's no meaningful
// prior-period baseline (e.g. yesterday was 0 — a % change against zero is
// either infinite or meaningless, not a real signal).
function deltaHTML(current, previous) {
  if (!previous) return '';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return `<span class="stat-delta stat-delta-flat">— flat</span>`;
  const up = pct > 0;
  return `<span class="stat-delta ${up ? 'stat-delta-up' : 'stat-delta-down'}">${up ? '▲' : '▼'} ${Math.abs(pct)}%</span>`;
}

function statCardHTML({ icon, n, l, delta = '' }) {
  return `
    <div class="stat-card has-icon">
      <div class="stat-icon">${icon}</div>
      <div class="stat-body">
        <div class="n">${escapeHtml(n)}</div>
        <div class="l">${escapeHtml(l)}</div>
      </div>
      ${delta}
    </div>`;
}

async function loadAnalytics() {
  const grid = document.getElementById('stat-grid');
  const engagementGrid = document.getElementById('engagement-grid');
  try {
    const d = await adminFetch('/analytics');

    grid.innerHTML = [
      statCardHTML({ icon: '👥', n: fmtNumber(d.dau), l: 'Active sessions today (DAU)', delta: deltaHTML(d.dau, d.dauYesterday) }),
      statCardHTML({ icon: '📅', n: fmtNumber(d.mau), l: 'Monthly active sessions (30d)' }),
      statCardHTML({ icon: '✨', n: fmtNumber(d.newToday), l: 'New viewers today' }),
      statCardHTML({ icon: '🔁', n: fmtNumber(d.returningToday), l: 'Returning viewers today' }),
    ].join('');

    engagementGrid.innerHTML = [
      statCardHTML({
        icon: '⏱️',
        n: fmtDuration(d.watchTimeSeconds.today),
        l: 'Watch time today',
        delta: deltaHTML(d.watchTimeSeconds.today, d.watchTimeSeconds.yesterday),
      }),
      statCardHTML({ icon: '📈', n: fmtDuration(d.watchTimeSeconds.last7d), l: 'Watch time (7 days)' }),
      statCardHTML({ icon: '🗓️', n: fmtDuration(d.watchTimeSeconds.last30d), l: 'Watch time (30 days)' }),
    ].join('');

    // Bug fix: this used to drop `activity_date` entirely (only `c` was
    // passed through), so the chart had no way to label its axis or show
    // which day a point belonged to — every point looked identical besides
    // its height.
    renderLineChart(
      document.getElementById('dau-chart'),
      d.dauTrend.map((r) => ({ date: r.activity_date, c: r.c }))
    );
  } catch (err) {
    grid.innerHTML = `<div class="admin-empty">Couldn't load analytics: ${escapeHtml(err.message)}</div>`;
    if (engagementGrid) engagementGrid.innerHTML = '';
  }
}

initAdminPage(loadAnalytics);
