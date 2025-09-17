// sw.js (robust installer + runtime caching)
const CACHE_NAME = 'farm-ledger-cache-v3';
const CORE_ASSETS = [
  '/',                // root
  'index.html',
  'styles.css',
  'script.js',
  'offline.html',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Helper to try caching one item and return status
async function tryCacheOne(cache, url) {
  try {
    const req = new Request(url, { mode: 'no-cors' }); // no-cors helps with opaque responses but may be limited
    const resp = await fetch(req);
    if (!resp || (resp.status && resp.status >= 400)) {
      throw new Error(`HTTP ${resp && resp.status}`);
    }
    await cache.put(url, resp.clone());
    return { url, ok: true };
  } catch (err) {
    return { url, ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// Install: try cache each asset and report failures (so SW still installs)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.all(CORE_ASSETS.map(url => tryCacheOne(cache, url)));
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      console.warn('Service worker: some resources failed to cache during install:', failed);
      // Optionally: you can remove failed items from cache if needed
    } else {
      console.log('Service worker: all core assets cached.');
    }
    // continue install regardless of failures
    self.skipWaiting();
  })());
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

// Navigation handler: network-first fallback-to-cache
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // update cache with fresh navigation response (optional)
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(()=>{/* ignore cache put error */});
    return response;
  } catch (err) {
    const cached = await caches.match('index.html');
    if (cached) return cached;
    const offline = await caches.match('offline.html');
    return offline || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);

  // Navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  // Same-origin static assets -> cache-first then network
  if (reqUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return resp;
        }).catch(() => {
          if (event.request.destination === 'image') {
            return caches.match('icons/icon-192.png');
          }
          return caches.match('offline.html');
        });
      })
    );
    return;
  }

  // Cross-origin -> try network only
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 504 })));
});
