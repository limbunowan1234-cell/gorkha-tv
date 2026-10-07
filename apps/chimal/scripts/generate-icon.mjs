// One-off placeholder-icon generator — NOT a shipped dependency (sharp is
// installed with --no-save specifically so it never lands in package.json).
// Renders GorkhaTV's real mountain-peaks logomark (the same path used on the
// website itself, gorkhatv2/templates/home.html's footer) in this app's own
// brand color, and rasterizes every size/variant Expo's asset pipeline
// expects. Run once per app: `node scripts/generate-icon.mjs <hexColor>`.
// Real designs can replace these same file paths later with zero other
// config changes needed.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const color = process.argv[2];
if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
  console.error('Usage: node scripts/generate-icon.mjs "#RRGGBB"');
  process.exit(1);
}

const DARK_BG = '#141414';
// GorkhaTV's mountain-peaks mark, viewBox 0 0 24 24 — same path as the
// website's own footer logomark.
const MARK_PATH = 'M3 18L8.5 7L13 14L16 10L21 18H3Z';

function markSvg({ size, scale, fill, bg }) {
  const markSize = size * scale;
  const offset = (size - markSize) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
    <g transform="translate(${offset},${offset}) scale(${markSize / 24})">
      <path d="${MARK_PATH}" fill="${fill}"/>
    </g>
  </svg>`;
}

async function render(svg, outPath) {
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('wrote', outPath);
}

mkdirSync('assets', { recursive: true });

await render(markSvg({ size: 1024, scale: 0.55, fill: color, bg: DARK_BG }), 'assets/icon.png');
await render(markSvg({ size: 1024, scale: 0.5, fill: color, bg: null }), 'assets/android-icon-foreground.png');
await render(markSvg({ size: 1024, scale: 1, fill: DARK_BG, bg: DARK_BG }), 'assets/android-icon-background.png');
await render(markSvg({ size: 1024, scale: 0.5, fill: '#ffffff', bg: null }), 'assets/android-icon-monochrome.png');
await render(markSvg({ size: 1024, scale: 0.4, fill: color, bg: null }), 'assets/splash-icon.png');
await render(markSvg({ size: 48, scale: 0.6, fill: color, bg: DARK_BG }), 'assets/favicon.png');

console.log(`Done — icons generated in ${color}.`);
