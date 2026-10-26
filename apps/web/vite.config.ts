import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
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
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/images/logo.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon.ico',
            sizes: '64x64',
            type: 'image/x-icon',
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
      'next/image': path.resolve(__dirname, 'src/shims/image.tsx'),
      'next/link': path.resolve(__dirname, 'src/shims/link.tsx'),
      'next/navigation': path.resolve(__dirname, 'src/shims/navigation.ts'),
      'next/dynamic': path.resolve(__dirname, 'src/shims/dynamic.tsx'),
      'next/script': path.resolve(__dirname, 'src/shims/script.tsx'),
      'next/font/google': path.resolve(__dirname, 'src/shims/font.ts'),
    },
  },
  server: { port: 3000, host: true },
  build: { outDir: 'dist', sourcemap: false },
});
