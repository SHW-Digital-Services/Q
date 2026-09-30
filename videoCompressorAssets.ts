import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function videoCompressorAssets(): Plugin {
  const files = Object.fromEntries(['worker.js', 'const.js', 'errors.js'].map(name => [name, resolve('node_modules/@ffmpeg/ffmpeg/dist/esm', name)]));
  for (const name of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) files[name] = resolve('node_modules/@ffmpeg/core/dist/esm', name);
  return { name: 'q-video-compressor-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].replace('/vendor/ffmpeg/', '');
        if (!req.url?.startsWith('/vendor/ffmpeg/') || !name || !Object.hasOwn(files, name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(files[name]));
      });
    },
    generateBundle() { for (const [name, file] of Object.entries(files)) this.emitFile({ type: 'asset', fileName: `vendor/ffmpeg/${name}`, source: readFileSync(file) }); },
  };
}
