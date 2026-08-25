// Stamps gorkhatv2/sw.js with a fresh cache version so every deploy
// automatically invalidates the service worker's cached app shell
// (/, style.css, api.js, home.js, ...) for returning visitors. Run via
// `npm run deploy` — never needs a manual version bump again.
//
// The version itself is arbitrary (any change to the CACHE_NAME string
// forces browsers to install a new service worker, which deletes the old
// cache on activate — see sw.js). A UTC timestamp is used because it's
// unique per run and human-readable in devtools when debugging.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const swPath = fileURLToPath(new URL('../gorkhatv2/sw.js', import.meta.url));
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

const src = readFileSync(swPath, 'utf8');
const next = src.replace(/const CACHE_NAME = ".*?";/, `const CACHE_NAME = "gorkhatv-shell-${version}";`);

if (next === src) {
  console.error('[bump-sw-cache] Could not find CACHE_NAME in sw.js — aborting deploy.');
  process.exit(1);
}

writeFileSync(swPath, next);
console.log(`[bump-sw-cache] gorkhatv2/sw.js -> gorkhatv-shell-${version}`);
