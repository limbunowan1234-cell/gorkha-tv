// Stamps every local <script src="...js"> / <link rel="stylesheet" href="...css">
// reference across gorkhatv2's HTML with a `?v=VERSION` cache-busting query,
// on every deploy. Run via `npm run deploy` (predeploy), alongside
// bump-sw-cache.mjs — never needs a manual edit as pages/scripts are added.
//
// Why this exists: Cloudflare Pages serves static JS/CSS with
// `Cache-Control: public, max-age=14400` (4h) and no revalidation until
// expiry. A plain, non-busted <script src="../js/playerBar.js"> tag can
// therefore keep serving a browser's locally-cached PRE-deploy copy of that
// file for up to 4 hours after a fix ships — completely independent of
// sw.js's own cache (bump-sw-cache.mjs already keeps THAT fresh every
// deploy) whenever a tab loads that script without sw.js's fetch handler
// actively intercepting the request (e.g. a fresh registration still
// installing, a dev/test browser with the SW unregistered, or simply the
// window between deploy and the next SW activation). Confirmed directly
// this session: a browser tab kept running a stale playerBar.js — missing a
// fix already live on the server — for exactly this reason, no service
// worker involved. A versioned query string makes the URL itself change on
// every deploy, so the browser's HTTP cache can never return pre-deploy
// bytes for it, regardless of SW state or Cache-Control headers.
//
// Deliberately narrow in scope, matching bump-sw-cache.mjs's own documented
// limitation: this only busts the STATIC <script>/<link> tags an HTML file
// references directly. A relative ES module import from within a JS file
// (e.g. playerBar.js's `import ... from './youtubeApi.js'`) can't carry a
// query string from its parent either way — sw.js's full shell-asset
// refetch on activate (see bump-sw-cache.mjs) is what keeps THOSE fresh.
// Together the two scripts cover both paths.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const rootDir = fileURLToPath(new URL('../gorkhatv2', import.meta.url));
const version = Date.now().toString(36);

function listHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listHtmlFiles(full));
    else if (extname(entry) === '.html') out.push(full);
  }
  return out;
}

// Matches src="PATH.js" / href="PATH.css" where PATH is same-origin (starts
// with "/", "./" or "../" — never an absolute http(s) URL, which rules out
// the Google Fonts/AdSense/Infolinks third-party tags on the same lines).
const ASSET_ATTR = /((?:src|href)=")((?:\.\.\/|\.\/|\/)[^"?]+?\.(?:js|css))(\?v=[a-z0-9]+)?(")/g;

// router.js and playerBar.js are each BOTH a top-level <script src>-tagged
// entry point AND relatively imported by other local JS files (watch.js,
// genre.js, home.js, chart.js all do `import ... from './router.js'` /
// './playerBar.js'). A relative import resolves against its importing
// module's own URL minus any query string — so if the HTML tag's src carried
// a "?v=" the relative import would NOT, and the two would resolve to two
// DIFFERENT URLs, meaning two SEPARATE module instances (duplicate
// router.js teardown registries, duplicate playerBar.js player/iframe
// state) — a correctness bug, not just a caching nicety. Left unversioned
// here on purpose; sw.js's own shell-asset full refetch (bump-sw-cache.mjs)
// is what keeps these two fresh across deploys instead, exactly like every
// other relatively-imported (never directly tagged) module already relies
// on that mechanism.
const SINGLETON_MODULES = new Set(['router.js', 'playerBar.js']);

let filesChanged = 0;
let tagsStamped = 0;

for (const file of listHtmlFiles(rootDir)) {
  const src = readFileSync(file, 'utf8');
  let changed = false;
  const next = src.replace(ASSET_ATTR, (match, prefix, path, _oldQuery, suffix) => {
    const basename = path.split('/').pop();
    if (SINGLETON_MODULES.has(basename)) {
      if (!_oldQuery) return match;
      changed = true;
      return `${prefix}${path}${suffix}`; // strip a stale ?v= from an earlier run
    }
    changed = true;
    tagsStamped += 1;
    return `${prefix}${path}?v=${version}${suffix}`;
  });
  if (changed) {
    writeFileSync(file, next);
    filesChanged += 1;
  }
}

console.log(`[bump-asset-version] v=${version} — stamped ${tagsStamped} local <script>/<link> tags across ${filesChanged} HTML files`);
