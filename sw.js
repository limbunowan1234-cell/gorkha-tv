// sw.js — GorkhaTV service worker
// Cache-first for static app shell assets; everything else (Appwrite API,
// YouTube embeds, dynamic pages) goes straight to network.

const CACHE_NAME = "gorkhatv-shell-v1";

const SHELL_ASSETS = [
  "/",
  "/css/style.css",
  "/js/main.js",
  "/js/appwrite.js",
  "/js/seo.js",
  "/logo-circle.png",
  "/logo-horizantal.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add individually so one missing file doesn't fail the whole install
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("[sw] skip", url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests on our own origin
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never cache Appwrite API calls or anything with a query string (dynamic pages)
  if (url.pathname.startsWith("/v1/") || url.search) {
    return;
  }

  // Cache-first for shell assets, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Cache successful same-origin static responses for next time
          if (response.ok && SHELL_ASSETS.includes(url.pathname)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached homepage for navigation requests
          if (request.mode === "navigate") {
            return caches.match("/");
          }
        });
    })
  );
});
