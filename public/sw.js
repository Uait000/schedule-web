// Progressive Web App Service Worker
const CACHE_NAME = 'ttgt-schedule-v4.0.0';
const APP_VERSION = '4.0.0';

// Ресурсы для кэширования при установке
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Установка версии', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Кэшируем основные ресурсы');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('✅ Все ресурсы закэшированы');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Ошибка кэширования:', error);
        return self.skipWaiting();
      })
  );
});

// Активация - очистка старых кэшей
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker: Активация');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Активна новая версия Service Worker');
      return self.clients.claim();
    })
  );
});

// Улучшенная обработка запросов с кэшированием API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Для API запросов - стратегия "Network First, then Cache"
  if (url.pathname.includes('/schedule') || url.pathname.includes('/overrides')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Кэшируем успешные API ответы
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Сохраняем с временной меткой
                const cachedResponse = {
                  body: responseClone.body,
                  headers: Object.fromEntries(responseClone.headers),
                  status: responseClone.status,
                  statusText: responseClone.statusText,
                  timestamp: Date.now()
                };
                
                cache.put(event.request, new Response(JSON.stringify(cachedResponse), {
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Cached-At': Date.now().toString()
                  }
                })).catch(err => {
                  console.warn('⚠️ Не удалось закэшировать API:', event.request.url, err);
                });
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback на кэш для API
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('📂 Используем кэшированные данные API:', event.request.url);
                return cachedResponse.json().then(data => {
                  // Проверяем свежесть данных (1 час)
                  const cacheTime = parseInt(cachedResponse.headers.get('X-Cached-At') || '0');
                  const oneHour = 60 * 60 * 1000;
                  
                  if (Date.now() - cacheTime < oneHour) {
                    return new Response(JSON.stringify(data.body), {
                      status: data.status,
                      statusText: data.statusText,
                      headers: data.headers
                    });
                  } else {
                    console.log('🗑️ Кэш устарел:', event.request.url);
                    throw new Error('Cache expired');
                  }
                });
              }
              throw new Error('No cache available');
            })
            .catch(() => {
              // Fallback для API - возвращаем пустые данные
              console.log('🌐 Нет соединения и нет кэша для:', event.request.url);
              return new Response(JSON.stringify({ 
                error: 'Оффлайн режим', 
                message: 'Нет подключения к интернету',
                timestamp: Date.now()
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }

  // Для статических ресурсов
  if (url.pathname.includes('/icon-') || 
      url.pathname.includes('/static/') ||
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css')) {
    
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache).catch(err => {
                      console.warn('⚠️ Не удалось закэшировать:', event.request.url, err);
                    });
                  });
              }
              return networkResponse;
            })
            .catch((error) => {
              console.warn('🌐 Ошибка загрузки:', event.request.url, error);
              return new Response('', { status: 404 });
            });
        })
    );
    return;
  }

  // Для HTML страниц - сеть с fallback на кэш
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone).catch(err => {
                console.warn('⚠️ Не удалось закэшировать HTML:', err);
              });
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/');
          });
      })
  );
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Фоновая синхронизация');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Можно добавить фоновое обновление данных
  console.log('🔄 Проверка обновлений в фоне');
}

// Обработка сообщений
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_API_DATA') {
    // Сохранение данных API из основного потока
    cacheApiData(event.data.url, event.data.data);
  }
});

async function cacheApiData(url, data) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify({
      body: data,
      timestamp: Date.now()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cached-At': Date.now().toString()
      }
    });
    
    await cache.put(new Request(url), response);
    console.log('💾 Данные API сохранены в кэш:', url);
  } catch (error) {
    console.error('❌ Ошибка сохранения данных API:', error);
  }
}