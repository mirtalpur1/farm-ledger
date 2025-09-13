const CACHE_NAME = 'farm-ledger-cache-v2';
const urlsToCache = [
  '/farm-ledger/',
  '/farm-ledger/index.html',
  '/farm-ledger/styles.css',
  '/farm-ledger/script.js',
  '/farm-ledger/offline.html',
  '/farm-ledger/icons/icon-192.png',
  '/farm-ledger/icons/icon-512.png'
];

// Install service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch requests
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() =>
        caches.match('/farm-ledger/offline.html')
      );
    })
  );
});
