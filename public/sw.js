// public/sw.js
const CACHE_NAME = 'ttgt-schedule-v4.3.2'; // Подняли версию для обновления
const APP_VERSION = '4.3.2';

// ВАЖНО: Здесь должны быть только те файлы, которые РЕАЛЬНО лежат в папке public
// или которые Vite копирует в корень dist (manifest, favicon и т.д.)
const PRECACHE_URLS = [
  '/manifest.json',
  '/favicon.ico',
  '/vite.svg', // Исправлено: в папке public лежит vite.svg, а не react.svg
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Мы используем map, чтобы отловить конкретный файл, который не грузится
        return Promise.all(
          PRECACHE_URLS.map(url => {
            return cache.add(url).catch(err => {
              console.error(`❌ Ошибка кэширования файла: ${url}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
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

  // 1. СТРАТЕГИЯ ДЛЯ INDEX.HTML И КОРНЯ (Network First)
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // 2. СТРАТЕГИЯ ДЛЯ API
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
  
  // 3. СТРАТЕГИЯ ДЛЯ СТАТИКИ (Cache First)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && (url.origin === self.location.origin)) {
           const resClone = response.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return response;
      });
    })
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