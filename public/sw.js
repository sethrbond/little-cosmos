/* Little Cosmos — Service Worker
   Strategy:
   - Navigation (HTML): network-first (always get latest), cache fallback for offline
   - Hashed assets (/assets/*): cache-first (immutable, Vite content-hashes filenames)
   - Other static files: stale-while-revalidate (serve cached, update in background)
   - Supabase/API: skip (let browser handle auth tokens, realtime WebSocket)
   - "On This Day" notifications: check on activate + periodic fetch
*/

const CACHE_NAME = 'cosmos-v7';

// Install — skip waiting to activate immediately
self.addEventListener('install', () => self.skipWaiting());

// Activate — claim clients + purge old caches + check "On This Day"
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notify clients of update
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
        // Check "On This Day" entries on activate
        checkOnThisDay();
      })
  );
});

// ---- "On This Day" notification check ----
// SW can't access localStorage directly, so we ask a client to send the data.
function checkOnThisDay() {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    if (clients.length > 0) {
      clients[0].postMessage({ type: 'OTD_CHECK_REQUEST' });
    }
  });
}

// Listen for the main thread sending cached entries for OTD check
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'OTD_CHECK_ENTRIES') {
    const { entries, firedIds, today } = e.data;
    if (!entries || !Array.isArray(entries)) return;

    const md = today.slice(5); // "MM-DD"
    const thisYear = parseInt(today.slice(0, 4));
    const alreadyFired = new Set(firedIds || []);
    const newFired = [];

    for (const entry of entries) {
      if (!entry.dateStart || alreadyFired.has(entry.id)) continue;
      const eYear = parseInt(entry.dateStart.slice(0, 4));
      if (eYear >= thisYear) continue;
      const eMd = entry.dateStart.slice(5);
      let match = eMd === md;
      if (!match && entry.dateEnd) {
        const endMd = entry.dateEnd.slice(5);
        match = eMd <= md && endMd >= md;
      }
      if (!match) continue;

      const yearsAgo = thisYear - eYear;
      const label = yearsAgo === 1 ? '1 year ago today' : `${yearsAgo} years ago today`;
      const body = `${label}: ${entry.city || 'A memory'}`;

      self.registration.showNotification('On This Day', {
        body,
        icon: '/icons/icon.svg',
        tag: `otd-${entry.id}`,
        data: { entryId: entry.id, worldId: entry.worldId || '' },
      });

      newFired.push(entry.id);
    }

    // Tell the client to update its fired tracking
    if (newFired.length > 0 && e.source) {
      e.source.postMessage({ type: 'OTD_FIRED', ids: newFired, today });
    }
  }
});

// Handle notification clicks — focus or open the app and navigate to entry
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const urlToOpen = '/?notif_entry=' + (data.entryId || '') + '&notif_world=' + (data.worldId || '');

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If the app is already open, focus it and send message
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            entryId: data.entryId,
            worldId: data.worldId,
          });
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Fetch handler
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip: non-GET, Supabase, WebSocket, chrome-extension
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Periodic "On This Day" check — piggyback on navigation fetches (once per day)
  if (e.request.mode === 'navigate') {
    checkOnThisDay();
  }

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
