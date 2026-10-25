import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 9320,
    // Dev-time parity with the edge: the SPA always calls relative paths.
    proxy: {
      '/api': 'http://127.0.0.1:9310',
      '/mcp': 'http://127.0.0.1:9300',
    },
  },
});
