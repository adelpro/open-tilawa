import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };
const app = JSON.parse(readFileSync('./app.json', 'utf8')) as {
  chrome: { light: string; dark: string };
  manifest: Record<string, unknown>;
};
const pages = JSON.parse(readFileSync('./seo/pages.json', 'utf8')) as {
  pages: Array<{ en: { description: string } }>;
};

/**
 * The window chrome, in dev. `npm run build` gets the same values from
 * `scripts/prerender.mjs`; both read `app.json`, so the two can't disagree. The
 * previous arrangement had the colour written in three files and the build
 * overwrote two of them.
 */
function windowChrome(): Plugin {
  const manifest = {
    ...app.manifest,
    description: pages.pages[0].en.description,
    theme_color: app.chrome.light,
    background_color: app.chrome.light,
  };

  return {
    name: 'tilawa-window-chrome',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/manifest.webmanifest') return next();
        res.setHeader('content-type', 'application/manifest+json');
        res.end(JSON.stringify(manifest, null, 2));
      });
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: {
          name: 'theme-color',
          content: app.chrome.light,
          media: '(prefers-color-scheme: light)',
        },
        injectTo: 'head',
      },
      {
        tag: 'meta',
        attrs: {
          name: 'theme-color',
          content: app.chrome.dark,
          media: '(prefers-color-scheme: dark)',
        },
        injectTo: 'head',
      },
      { tag: 'meta', attrs: { name: 'color-scheme', content: 'light dark' }, injectTo: 'head' },
    ],
  };
}

export default defineConfig({
  plugins: [react(), windowChrome()],
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
