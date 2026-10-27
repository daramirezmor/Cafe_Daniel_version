import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function mediapipeHandsStaticPlugin(): Plugin {
  const mpDir = path.resolve(process.cwd(), 'node_modules/@mediapipe/hands');

  const getMimeType = (fileName: string): string => {
    if (fileName.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (fileName.endsWith('.wasm')) return 'application/wasm';
    if (fileName.endsWith('.json')) return 'application/json; charset=utf-8';
    return 'application/octet-stream';
  };

  const serveMiddleware = (req: any, res: any, next: any) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url.startsWith('/mediapipe-hands/')) {
      const fileName = path.basename(url);
      const filePath = path.join(mpDir, fileName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.setHeader('Content-Type', getMimeType(fileName));
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    next();
  };

  return {
    name: 'mediapipe-hands-static',
    configureServer(server) {
      server.middlewares.use(serveMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveMiddleware);
    },
    writeBundle(options) {
      const outDir = options.dir || path.resolve(process.cwd(), 'dist');
      const targetDir = path.join(outDir, 'mediapipe-hands');
      if (!fs.existsSync(mpDir)) return;
      fs.mkdirSync(targetDir, { recursive: true });
      for (const file of fs.readdirSync(mpDir)) {
        const srcFile = path.join(mpDir, file);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, path.join(targetDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  // GitHub Pages hosts this repository under /Cafe_Daniel_version/; local
  // development and preview continue to use the site root.
  base: process.env.GITHUB_ACTIONS ? '/Cafe_Daniel_version/' : '/',
  plugins: [react(), mediapipeHandsStaticPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    cors: true,
  },
});
