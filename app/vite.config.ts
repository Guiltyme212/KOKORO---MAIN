import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Kokoro',
        short_name: 'Kokoro',
        description: 'Personalized voice rituals for the moments you need them.',
        start_url: '/#welcome',
        scope: '/',
        display: 'standalone',
        background_color: '#F6EBD7',
        theme_color: '#F6EBD7',
        icons: [
          { src: '/icons/kokoro-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/kokoro-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/kokoro-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only. No API, generated audio, video, or provider response
        // is put in a runtime cache.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    // Railway's reverse proxy forwards requests with the public *.railway.app
    // hostname, which Vite's preview server rejects by default. Allow any host.
    allowedHosts: true,
  },
});
