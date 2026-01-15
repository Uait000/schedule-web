// public/sw.js
const CACHE_NAME = 'ttgt-schedule-v4.3.0';
const APP_VERSION = '4.3.0';

const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

async function getActiveProfileId() {
  return new Promise((resolve) => {
    const request = indexedDB.open("NotificationSettings", 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("settings")) { resolve(null); return; }
      const transaction = db.transaction("settings", "readonly");
      const store = transaction.objectStore("settings");
      const getReq = store.get("activeProfileId");
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    try {
      const data = event.data.json();
      const activeProfileId = await getActiveProfileId();
      if (data.target && activeProfileId && String(data.target) !== String(activeProfileId)) return;

      const options = {
        body: data.body || 'Изменения в расписании!',
        icon: '/icon-192x192.png',
        badge: '/favicon.ico',
        tag: 'schedule-update',
        renotify: true,
        data: { url: data.url || '/' }
      };
      await self.registration.showNotification(data.title || 'ТТЖТ', options);
    } catch (e) { console.error('Push error:', e); }
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  
  if (url.pathname.includes('/schedule') || url.pathname.includes('/overrides')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            responseClone.json().then(data => {
              const cachedResponse = { body: data, timestamp: Date.now() };
              cache.put(event.request, new Response(JSON.stringify(cachedResponse), {
                headers: { 'Content-Type': 'application/json' }
              }));
            }).catch(() => {});
          });
        }
        return response;
      }).catch(async (err) => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        
        // 🔥 ВОЗВРАЩАЕМ КОРРЕКТНЫЙ RESPONSE ПРИ СБОЕ
        return new Response(
            JSON.stringify({ error: "Network Error", detail: err.message }), 
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
      })
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_ACTIVE_PROFILE') {
    const profileId = event.data.profileId;
    const request = indexedDB.open("NotificationSettings", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction("settings", "readwrite");
      transaction.objectStore("settings").put(profileId, "activeProfileId");
    };
  }
});