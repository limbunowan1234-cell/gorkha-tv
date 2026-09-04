// Minimal inline-SVG line chart — no charting library. This codebase has no
// CDN-script precedent anywhere and its ethos is no-build-step/no-framework;
// one trend line doesn't justify the first third-party dependency.
//
// points: [{ date: 'YYYY-MM-DD', c: number }, ...] — expects `date` for axis
// labels and hover tooltips; a point without `date` still renders (just with
// no label/tooltip), so this degrades gracefully if a caller only has counts.
export function renderLineChart(container, points, { height = 200 } = {}) {
  if (!points.length) {
    container.innerHTML = `<div class="admin-empty">No data yet</div>`;
    return;
  }

  const width = 760;
  const padLeft = 34; // room for y-axis value labels
  const padBottom = 22; // room for x-axis date labels
  const padTop = 12;
  const plotW = width - padLeft;
  const plotH = height - padTop - padBottom;

  const max = Math.max(1, ...points.map((p) => p.c));
  // Round the axis ceiling up to a "nice" number so gridline labels read
  // like 20/40/60/80 instead of an arbitrary 37/74/111/148.
  const niceMax = niceCeiling(max);
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const xy = (i, c) => {
    const x = padLeft + i * stepX;
    const y = padTop + plotH - (c / niceMax) * plotH;
    return [x, y];
  };

  const linePoints = points.map((p, i) => xy(i, p.c));
  const lineStr = linePoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaStr = `${padLeft},${(padTop + plotH).toFixed(1)} ${lineStr} ${(padLeft + plotW).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

  // 4 evenly-spaced horizontal gridlines (0 at the bottom, niceMax at top).
  const gridCount = 4;
  const gridlines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const value = Math.round((niceMax / gridCount) * i);
    const y = padTop + plotH - (i / gridCount) * plotH;
    return `
      <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}" class="chart-gridline" />
      <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="chart-axis-label">${value}</text>`;
  }).join('');

  // A handful of x-axis date labels (avoid clutter for 30 points) — first,
  // last, and a few evenly spaced in between.
  const labelCount = Math.min(points.length, 6);
  const labelIndices = Array.from({ length: labelCount }, (_, i) => Math.round((i * (points.length - 1)) / Math.max(1, labelCount - 1)));
  const xLabels = [...new Set(labelIndices)]
    .map((i) => {
      const [x] = xy(i, points[i].c);
      const label = formatShortDate(points[i].date);
      if (!label) return '';
      return `<text x="${x.toFixed(1)}" y="${height - 4}" text-anchor="middle" class="chart-axis-label">${label}</text>`;
    })
    .join('');

  const dots = points
    .map((p, i) => {
      const [x, y] = xy(i, p.c);
      const label = formatLongDate(p.date);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="chart-dot"><title>${label ? `${label}: ` : ''}${p.c} session${p.c === 1 ? '' : 's'}</title></circle>`;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;" class="chart-svg">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--red)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--red)" stop-opacity="0" />
        </linearGradient>
      </defs>
      ${gridlines}
      <polygon points="${areaStr}" fill="url(#chart-fill)" />
      <polyline points="${lineStr}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      ${dots}
      ${xLabels}
    </svg>`;
}

function niceCeiling(n) {
  if (n <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  const normalized = n / magnitude;
  const niceNormalized = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
