/* Little Cosmos — Service Worker
   Strategy:
   - Navigation (HTML): network-first (always get latest), cache fallback for offline
   - Hashed assets (/assets/*): cache-first (immutable, Vite content-hashes filenames)
   - Other static files: stale-while-revalidate (serve cached, update in background)
   - Supabase/API: skip (let browser handle auth tokens, realtime WebSocket)
*/

const CACHE_NAME = 'cosmos-v3';

// Install — skip waiting to activate immediately
self.addEventListener('install', () => self.skipWaiting());

// Activate — claim clients + purge old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip: non-GET, Supabase, WebSocket, chrome-extension
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Navigation (HTML pages) — network-first, cache fallback for offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/')))
    );
    return;
  }

  // Vite hashed assets (/assets/index-abc123.js) — cache-first (immutable)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Other static files (icons, manifest, og-image) — stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|json|webp)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});
