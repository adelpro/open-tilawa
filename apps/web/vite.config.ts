import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { redact } from '@tanstack/redact/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Redact replaces the React runtime with a smaller, synchronous one; the
    // app keeps importing react/react-dom as usual.
    redact(),
    // One service worker for the whole origin: the PWA worker and WebTorrent's
    // streaming worker are merged in src/sw.js (see apps/web/README.md).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      // Registration lives in src/utils/webtorrent-client.ts: `createServer()`
      // needs the ServiceWorkerRegistration object, so it cannot be auto-injected.
      injectRegister: null,
      injectManifest: {
        // Shell only. Fonts, images and the WebTorrent bundle are cached on
        // first use: 21 blocking precache requests turned a slow link into a
        // worker that never activated, and without a worker there is no stream.
        globPatterns: ['**/*.{js,css,html,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Open Tilawa',
        short_name: 'Tilawa',
        description: 'Quran recitations streamed over WebTorrent',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        // Square, mono, on-palette. The previous entry pointed at the wide
        // wordmark raster, which launchers cropped into a smudge and which
        // carried the navy brand colour into an app that is otherwise greys.
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@svgs': path.resolve(__dirname, 'src/svgs'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
    },
  },
  server: { port: 3000, host: true },
  build: { outDir: 'dist', sourcemap: false },
});
