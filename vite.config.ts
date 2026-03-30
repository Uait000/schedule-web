import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // Оставляем false, если вы регистрируете воркер вручную в main.tsx
      workbox: {
        // Кэшируем все эти типы файлов для работы без сети
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        
        // 🔥 РЕШЕНИЕ ПРОБЛЕМЫ F5: 
        // Если юзер обновил страницу без сети, всегда отдаем базовый index.html
        navigateFallback: '/index.html',
        
        // Исключаем API-запросы из этого правила, чтобы вместо JSON не прилетал HTML-код
        navigateFallbackDenylist: [/^\/api/],
        
        // Автоматически удаляем старые версии файлов из кэша
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Расписание ТТЖТ',
        short_name: 'ТТЖТ',
        theme_color: '#1c1c1e',
        background_color: '#1c1c1e',
        display: 'standalone',
        start_url: '/'
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://schedulettgt.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'https://schedulettgt.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  base: '/'
})