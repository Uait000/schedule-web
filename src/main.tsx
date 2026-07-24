import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom' 
import { migrateOldDataToDataStore } from './utils/migration'
import { ErrorBoundary } from './components/ErrorBoundary'

const APP_VERSION = '5.0.1';

// 🔥 ИСПРАВЛЕНИЕ 1: Глобальный перехват ошибок загрузки модулей и чанков
window.addEventListener('error', (e) => {
  const message = e.message || '';
  const target = e.target as any;

  // ChunkLoadError or module loading errors
  if (message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') ||
      message.includes('does not provide an export') ||
      message.includes('Failed to fetch dynamically imported') ||
      (target && target.tagName === 'SCRIPT')) {
    console.warn('Ошибка загрузки модуля. Очистка кэша и перезагрузка...');
    if ('caches' in window) {
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs =>
        Promise.all(regs.map(r => r.unregister()))
      );
    }
    localStorage.setItem('app_purge_ver', APP_VERSION);
    setTimeout(() => window.location.reload(), 100);
  }
}, true);

// 🔥 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КЭША ПРИ ОБНОВЛЕНИИ
const storedVersion = localStorage.getItem('app_purge_ver');
if (storedVersion !== APP_VERSION) {
  console.log(`🔄 Обновление с ${storedVersion || 'первого запуска'} → ${APP_VERSION}. Очистка кэша...`);
  if ('caches' in window) {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      Promise.all(regs.map(r => r.unregister()))
    );
  }
  localStorage.setItem('app_purge_ver', APP_VERSION);
  window.location.reload();
}

// Инициализация Telegram Web App
declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

// 🔥 ИСПРАВЛЕНИЕ 2: Безопасный запуск миграции (чтобы битые данные в кэше не "вешали" старт)
try {
  migrateOldDataToDataStore();
} catch (error) {
  console.error('⚠️ Критическая ошибка при миграции данных:', error);
}

// PWA Service Worker регистрация
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ PWA Service Worker зарегистрирован');
        
        // Проверка обновлений
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('🆕 Доступна новая версия PWA');
                  // Здесь можно добавить уведомление для пользователя
                } else {
                  console.log('📱 PWA готов к работе оффлайн');
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        console.log('❌ Ошибка регистрации PWA Service Worker:', error);
      });
  });

  // Автоматическая перезагрузка страниц при смене контроллера (активация нового SW)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// Проверка PWA статуса
const checkPWAStatus = () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInstalled = (window.navigator as any).standalone || isStandalone;
  
  if (isInstalled) {
    console.log('🎉 Приложение запущено как установленное PWA');
    document.documentElement.classList.add('pwa-installed');
  }
  
  return isInstalled;
};

// Инициализация PWA
checkPWAStatus();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
)

console.log('🚀 Расписание ТТЖТ запущено');
console.log('📱 PWA статус:', {
  installed: checkPWAStatus(),
  serviceWorker: 'serviceWorker' in navigator,
  standalone: window.matchMedia('(display-mode: standalone)').matches
});