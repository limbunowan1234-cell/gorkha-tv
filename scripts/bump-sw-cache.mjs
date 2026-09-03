// Stamps gorkhatv2/sw.js with a fresh cache version so every deploy
// automatically invalidates the service worker's cached app shell for
// returning visitors, and regenerates the shell's JS/CSS asset list from
// what's actually in gorkhatv2/js and gorkhatv2/css. Run via `npm run
// deploy` — never needs a manual version bump or asset-list edit again.
//
// The version itself is arbitrary (any change to the CACHE_NAME string
// forces browsers to install a new service worker, which deletes the old
// cache on activate — see sw.js). A UTC timestamp is used because it's
// unique per run and human-readable in devtools when debugging.
//
// Why regenerate the asset list too, not just the version: most local JS
// files (api.js, auth.js, admin-common.js, ...) are never directly
// <script>-tagged — they're reached only via a relative ES module import
// from an entry-point script (e.g. home.js's `import ... from './api.js'`),
// and a relative import can't carry a cache-busting query string from its
// parent. So a query-string trick on <script> tags alone would miss every
// transitively-imported module. Listing every local JS/CSS file in sw.js's
// SHELL_ASSETS instead means the service worker's install-time refetch
// (see sw.js — it fetches with {cache:'reload'}, bypassing the browser's
// own HTTP cache) refreshes all of them uniformly on every deploy, with no
// per-file bookkeeping required as files are added or removed.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const swPath = fileURLToPath(new URL('../gorkhatv2/sw.js', import.meta.url));
const jsDir = fileURLToPath(new URL('../gorkhatv2/js', import.meta.url));
const cssDir = fileURLToPath(new URL('../gorkhatv2/css', import.meta.url));
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

let src = readFileSync(swPath, 'utf8');

const next = src.replace(/const CACHE_NAME = ".*?";/, `const CACHE_NAME = "gorkhatv-shell-${version}";`);
if (next === src) {
  console.error('[bump-sw-cache] Could not find CACHE_NAME in sw.js — aborting deploy.');
  process.exit(1);
}
src = next;

const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort();
const generatedLines = [...cssFiles.map((f) => `/css/${f}`), ...jsFiles.map((f) => `/js/${f}`)]
  .map((path) => `  "${path}",`)
  .join('\n');

const markerPattern = /( *)\/\/ AUTO-GENERATED-ASSETS-START[\s\S]*?\/\/ AUTO-GENERATED-ASSETS-END/;
if (!markerPattern.test(src)) {
  console.error('[bump-sw-cache] Could not find AUTO-GENERATED-ASSETS markers in sw.js — aborting deploy.');
  process.exit(1);
}
src = src.replace(markerPattern, (match, indent) => `${indent}// AUTO-GENERATED-ASSETS-START\n${generatedLines}\n${indent}// AUTO-GENERATED-ASSETS-END`);

writeFileSync(swPath, src);
console.log(`[bump-sw-cache] gorkhatv2/sw.js -> gorkhatv-shell-${version} (${jsFiles.length} js + ${cssFiles.length} css shell assets)`);
