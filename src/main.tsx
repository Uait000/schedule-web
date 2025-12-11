import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom' 
import { migrateOldDataToDataStore } from './utils/migration'

// Инициализация Telegram Web App
declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

// Мигрируем данные при запуске приложения
migrateOldDataToDataStore();

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