import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    
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
