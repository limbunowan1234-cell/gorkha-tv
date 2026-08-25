// Minimal inline-SVG line chart — no charting library. This codebase has no
// CDN-script precedent anywhere and its ethos is no-build-step/no-framework;
// two simple trend lines don't justify the first third-party dependency.
export function renderLineChart(container, points, { height = 160 } = {}) {
  if (!points.length) {
    container.innerHTML = `<div class="admin-empty">No data yet</div>`;
    return;
  }
  const width = 680;
  const max = Math.max(1, ...points.map((p) => p.c));
  const stepX = width / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => `${(i * stepX).toFixed(1)},${(height - (p.c / max) * (height - 16) - 8).toFixed(1)}`).join(' ');
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;">
    <polyline points="${coords}" fill="none" stroke="var(--red)" stroke-width="2"/>
  </svg>`;
}
