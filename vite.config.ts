import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, 
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        
        navigateFallback: '/index.html',
        
        navigateFallbackDenylist: [/^\/api/],
        
        cleanupOutdatedCaches: true,

        skipWaiting: true,
        clientsClaim: true,
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