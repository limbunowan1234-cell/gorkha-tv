// GorkhaTV Beats' client-side navigation — the first (and, deliberately,
// only) router in this codebase, scoped tightly to keep the persistent
// player bar (js/playerBar.js) alive across "page changes." Every other
// page on the site is still a real, separate navigation, exactly as
// before — this only intercepts clicks between the three Beats pages:
// /pages/chart.html, /genre/music, and /watch/:id (any video — a click
// from within the Beats triangle to a watch page is intercepted even if
// that video turns out not to be music; a real navigation from a watch
// page to somewhere outside the triangle, e.g. Home, ends persistence,
// which is the correct, documented degradation).
//
// Why this exists at all: a real page navigation destroys every live
// iframe and all JS state — confirmed there is no service-worker or other
// hook that can keep audio playing across one. The only way to keep the
// player bar's iframe alive is to stop doing real navigations for these
// three pages: fetch the destination's HTML, swap only the page-specific
// #page-content region, and leave #player-bar-root (and everything else
// outside #page-content — <nav>, #mobile-nav-root) untouched.

const TRIANGLE_PATTERNS = [/^\/pages\/chart\.html$/, /^\/genre\/music$/, /^\/watch\/[^/?#]+$/];

function isTrianglePath(pathname) {
  return TRIANGLE_PATTERNS.some((re) => re.test(pathname));
}

function entryScriptFor(pathname) {
  if (pathname === '/pages/chart.html') return '/js/chart.js';
  if (pathname === '/genre/music') return '/js/genre.js';
  if (pathname.startsWith('/watch/')) return '/js/watch.js';
  return null;
}

let teardownFns = [];
export function registerTeardown(fn) {
  teardownFns.push(fn);
}
function runTeardown() {
  teardownFns.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a broken teardown shouldn't block navigation */
    }
  });
  teardownFns = [];
}

let inFlightController = null;
const scrollPositions = new Map();
let scrollTicket = 0;

async function transitionTo(url, { push }) {
  if (inFlightController) inFlightController.abort();
  inFlightController = new AbortController();
  const { signal } = inFlightController;

  let html;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) {
      window.location.href = url;
      return;
    }
    html = await res.text();
  } catch (err) {
    if (signal.aborted) return; // superseded by a newer click — not a real failure
    window.location.href = url;
    return;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const newContent = doc.getElementById('page-content');
  const newStyle = doc.getElementById('page-style');
  if (!newContent) {
    // Destination isn't a router-participating page (or the marker is
    // missing for any other reason) — same safe fallback as a genuine
    // fetch failure above: a real navigation, nothing torn down yet.
    window.location.href = url;
    return;
  }

  runTeardown();

  document.title = doc.title;
  const styleEl = document.getElementById('page-style');
  if (styleEl && newStyle) styleEl.textContent = newStyle.textContent;
  document.getElementById('page-content').innerHTML = newContent.innerHTML;

  // <head> itself is never swapped (ad-network scripts/fonts there must
  // only ever load once) — but some SSR routes (genre/[slug].js's
  // window.__GENRE, category/[cat].js's and location/[loc].js's
  // window.__PRESET) inject a page's own data as an inline <head> script,
  // which an innerHTML-based swap would never execute. Re-run only that
  // narrow, known pattern — never the ad-network scripts, which live in
  // <head> too but must not be re-fired on every transition.
  doc.head.querySelectorAll('script:not([src])').forEach((s) => {
    const text = s.textContent || '';
    if (!/^\s*window\.__\w+\s*=/.test(text)) return;
    const el = document.createElement('script');
    el.textContent = text;
    document.head.appendChild(el);
    el.remove();
  });

  // Meta/OG tags are cosmetic-only here (best-effort) — a crawler or a
  // viewer's own "share"/bookmark action always hits the real SSR route
  // directly, never this client-side swap, so correctness there is
  // unaffected either way.
  const desc = doc.querySelector('meta[name="description"]');
  if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc.getAttribute('content') || '');

  const entry = entryScriptFor(new URL(url, window.location.origin).pathname);
  if (entry) {
    try {
      await import(/* @vite-ignore */ `${entry}?t=${Date.now()}`);
    } catch {
      /* a broken re-import shouldn't strand the viewer on dead markup — worst case this page's own JS just doesn't run */
    }
  }

  if (window.initMobileNav) window.initMobileNav();

  if (push) {
    scrollTicket += 1;
    window.scrollTo(0, 0);
    history.pushState({ gtvSwap: true, scrollId: scrollTicket }, '', url);
  } else {
    const saved = scrollPositions.get(history.state?.scrollId);
    window.scrollTo(0, saved || 0);
  }
}

function isEligibleClick(e, anchor) {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  let dest;
  try {
    dest = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (dest.origin !== window.location.origin) return false;
  if (!isTrianglePath(window.location.pathname) || !isTrianglePath(dest.pathname)) return false;
  return dest;
}

document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a[href]');
  if (!anchor) return;
  const dest = isEligibleClick(e, anchor);
  if (!dest) return;
  e.preventDefault();
  transitionTo(dest.pathname + dest.search, { push: true });
});

window.addEventListener('popstate', (e) => {
  scrollPositions.set(history.state?.scrollId, window.scrollY);
  if (e.state?.gtvSwap) transitionTo(location.pathname + location.search, { push: false });
  // else: a history entry from before the router was active on this page
  // load — let the browser's own default back/forward behavior stand.
});

// Lets js/watch.js (and anything else) know it's safe to hand playback off
// to the persistent player bar instead of creating its own throwaway
// player — set once, at first import, and never unset (a real page reload
// always creates a brand-new module instance with this reset to false
// again, which is the correct, honest signal: persistence only ever works
// through this router's fetch+swap path).
window.__gtvRouterActive = true;

// Exposes the router's own navigate function for callers that need to
// trigger a transition programmatically (e.g. js/playerBar.js advancing
// to the next queued track while the viewer is sitting on a watch page).
export function navigate(url, opts) {
  transitionTo(url, { push: true, ...opts });
}
