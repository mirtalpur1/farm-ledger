// sw.js (fixed minimal core assets)
const CACHE_NAME = 'farm-ledger-cache-v3';

// Minimal list — only files you definitely have in the same folder as index.html (assets root)
const CORE_ASSETS = [
  'index.html',
  'offline.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Install: cache core assets (tries each and logs failures)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.all(CORE_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res || (res.status && res.status >= 400)) throw new Error('HTTP ' + (res && res.status));
        await cache.put(url, res.clone());
        return { url, ok: true };
      } catch (err) {
        return { url, ok: false, error: err && err.message ? err.message : String(err) };
      }
    }));
    const failed = results.filter(r => !r.ok);
    if (failed.length) console.warn('Service worker: some resources failed to cache during install:', failed);
    else console.log('Service worker: all core assets cached.');
    self.skipWaiting();
  })());
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

// Navigation: network-first then cache then offline fallback
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(()=>{});
    return response;
  } catch (err) {
    const cached = await caches.match('index.html');
    if (cached) return cached;
    const offline = await caches.match('offline.html');
    return offline || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Fetch handler (cache-first for same-origin assets)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  if (reqUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp && resp.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resp.clone()));
          }
          return resp;
        }).catch(() => {
          if (event.request.destination === 'image') return caches.match('icons/icon-192.png');
          return caches.match('offline.html');
        });
      })
    );
    return;
  }

  // cross-origin requests: network-only fallback
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 504 })));
});
