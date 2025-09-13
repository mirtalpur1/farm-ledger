const CACHE_NAME = "farm-ledger-v1";
const CORE_ASSETS = [
  "/farm-ledger/",
  "/farm-ledger/index.html",
  "/farm-ledger/styles.css",
  "/farm-ledger/script.js",
  "/farm-ledger/offline.html",
  "/farm-ledger/icons/icon-192.png",
  "/farm-ledger/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/farm-ledger/offline.html"))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(resp => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, resp.clone());
            return resp;
          });
        });
      })
    );
  }
});
