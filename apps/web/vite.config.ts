import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo*.png', 'icon.svg'],
      manifest: {
        name: 'Open Quran',
        short_name: 'Open Quran',
        description: 'استمع إلى تلاوات سيل القرآن',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
      },
      devOptions: { enabled: false },
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
