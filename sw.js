const CACHE_NAME = 'farm-ledger-cache-v1';
const urlsToCache = [
  '/farm-ledger/',
  '/farm-ledger/index.html',
  '/farm-ledger/styles.css',
  '/farm-ledger/script.js',
  '/farm-ledger/offline.html',
  '/farm-ledger/icons/icon-192.png',
  '/farm-ledger/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => caches.match('/farm-ledger/offline.html'))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});
