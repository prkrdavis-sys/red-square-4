import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

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

export default defineConfig({
  plugins: [saveFilePlugin()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
  },
});
