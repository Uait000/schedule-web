// public/sw.js
const CACHE_NAME = 'ttgt-schedule-v5.0.1';
const APP_VERSION = '5.0.1';

// Precache: только статика из папки public
const PRECACHE_URLS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-192x192.png',
  '/icon-maskable-512x512.png'
];

// ==========================================
// INSTALL
// ==========================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

// ==========================================
// ACTIVATE
// ==========================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ==========================================
// FETCH
// ==========================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // 1. HTML: Network First, fallback to cache
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. API: Network First with cache fallback
  if (url.pathname.includes('/schedule/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          // Return offline-friendly response
          return new Response(JSON.stringify({
            offline: true,
            schedule: null,
            overrides: null,
            events: [],
            message: 'Офлайн режим'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 3. Static: Cache First, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
  );
});

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'Изменения в расписании!',
        icon: '/icon-192x192.png',
        badge: '/favicon.ico',
        tag: 'schedule-update',
        renotify: true,
        data: { url: data.url || '/' }
      };
      await self.registration.showNotification(data.title || 'ТТЖТ', options);
    } catch (e) {}
  })());
});

// ==========================================
// MESSAGE HANDLER
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
