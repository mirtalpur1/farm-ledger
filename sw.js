// /farm-ledger/sw.js
const CACHE_NAME = 'farm-ledger-cache-v3';
const CORE_ASSETS = [
  '/farm-ledger/',
  '/farm-ledger/index.html',
  '/farm-ledger/styles.css',
  '/farm-ledger/script.js',
  '/farm-ledger/offline.html',
  '/farm-ledger/icons/icon-192.png',
  '/farm-ledger/icons/icon-512.png'
];

// Install: pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

// Helper: network-first for navigations (get latest, fallback to cache/offline)
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // Optionally update cache for navigation
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    // network failed -> try cache, then offline fallback
    const cached = await caches.match('/farm-ledger/index.html') || await caches.match('/farm-ledger/');
    if (cached) return cached;
    const offline = await caches.match('/farm-ledger/offline.html');
    return offline || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Fetch handler
self.addEventListener('fetch', event => {
  // only handle GET
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);

  // For navigation requests -> network first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  // For other same-origin requests -> cache-first
  if (reqUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(resp => {
            // cache runtime resources (images, scripts) but skip opaque errors
            if (resp && resp.status === 200) {
              const copy = resp.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            }
            return resp;
          })
          .catch(() => {
            // fallback for images -> offline icon (optional)
            if (event.request.destination === 'image') {
              return caches.match('/farm-ledger/icons/icon-192.png');
            }
            return caches.match('/farm-ledger/offline.html');
          });
      })
    );
    return;
  }

  // For cross-origin requests (ads/analytics) -> try network fallback to nothing
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 504, statusText: 'Network error' }))
  );
});
