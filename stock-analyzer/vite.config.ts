import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // ВАЖНО: Путь к репозиторию на GitHub Pages
  base: '/stock-analyzer/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Анализатор фондовых стратегий MOEX',
        short_name: 'MOEX Стратегии',
        description: 'Оффлайн-платформа бэктестинга и анализа портфельных стратегий',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/stock-analyzer/',
        start_url: '/stock-analyzer/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/stock-analyzer/index.html',
        navigateFallbackDenylist: [/^\/iss\.moex\.com/],
      }
    })
  ]
});