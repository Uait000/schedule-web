import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom' 
import { migrateOldDataToDataStore } from './utils/migration'

// 🔥 ИСПРАВЛЕНИЕ 1: Глобальный перехват ошибок загрузки чанков (решает проблему серого экрана при обновлениях)
window.addEventListener('error', (e) => {
  const message = e.message || '';
  if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
    console.warn('Обнаружена ошибка загрузки ресурсов. Перезагрузка приложения...');
    window.location.reload();
  }
}, true);

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
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

console.log('🚀 Расписание ТТЖТ запущено');
console.log('📱 PWA статус:', {
  installed: checkPWAStatus(),
  serviceWorker: 'serviceWorker' in navigator,
  standalone: window.matchMedia('(display-mode: standalone)').matches
});