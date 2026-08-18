import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const SAVE_FILE = path.resolve('.red-square-save.json');
const SAVE_URL = '/__save';
const MAX_BYTES = 32_000;

function send(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
  status: number,
  body?: string,
): void {
  res.statusCode = status;
  if (body !== undefined) {
    res.setHeader('Content-Type', 'application/json');
    res.end(body);
    return;
  }
  res.end();
}

function saveFilePlugin(): Plugin {
  const middleware = (
    req: { method?: string; url?: string; on: (event: string, cb: (chunk?: Buffer) => void) => void },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
    next: () => void,
  ) => {
    const url = req.url?.split('?')[0];
    if (url !== SAVE_URL && url !== `${SAVE_URL}/`) {
      next();
      return;
    }
    if (req.method === 'GET') {
      if (!fs.existsSync(SAVE_FILE)) {
        send(res, 404);
        return;
      }
      send(res, 200, fs.readFileSync(SAVE_FILE, 'utf8'));
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const chunks: Buffer[] = [];
      let total = 0;
      req.on('data', (chunk) => {
        if (!chunk) {
          return;
        }
        total += chunk.length;
        if (total <= MAX_BYTES) {
          chunks.push(chunk);
        }
      });
      req.on('end', () => {
        if (total > MAX_BYTES) {
          send(res, 413);
          return;
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') {
            send(res, 400);
            return;
          }
        } catch {
          send(res, 400);
          return;
        }
        fs.writeFileSync(SAVE_FILE, raw, 'utf8');
        send(res, 204);
      });
      return;
    }
    send(res, 405);
  };

  return {
    name: 'red-square-save-file',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function excludeVendorAssets(): Plugin {
  return {
    name: 'exclude-vendor-assets',
    closeBundle() {
      const vendor = path.resolve('dist/assets/vendor');
      if (fs.existsSync(vendor)) {
        fs.rmSync(vendor, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    saveFilePlugin(),
    excludeVendorAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Red Square 4',
        short_name: 'Red Square 4',
        description: 'A Mario-inspired 2D platformer. You are a red square.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        orientation: 'landscape',
        background_color: '#0b0b12',
        theme_color: '#0b0b12',
        categories: ['games'],
        handle_links: 'preferred',
        launch_handler: {
          client_mode: ['navigate-existing', 'auto'],
        },
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,ogg,webmanifest}'],
        globIgnores: ['**/vendor/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__save/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    open: false,
  },
  preview: {
    host: true,
  },
  build: {
    target: 'es2022',
  },
});
