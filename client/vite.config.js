import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Ship the emoji SVG + generated PNGs as top-level assets.
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'KidsBrain',
        short_name: 'KidsBrain',
        description: 'Personalized brain games for kids.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1A1A2E',
        theme_color: '#1A1A2E',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App-shell caching — fast repeat loads, minimal offline shell.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // NEVER cache API or the /game-host iframe URL. API responses may
        // carry the child's JWT-authorized payloads; the game-host route
        // must always talk to the current shell version.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/game-host/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^\/game-host/,
            handler: 'NetworkOnly'
          }
        ]
      },
      devOptions: {
        // Keep the SW off in dev so HMR + our sandbox debugging aren't
        // subject to a stale cache. Enable manually if needed.
        enabled: false
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
