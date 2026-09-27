// Test-only server: exercise the launched app without changing the real launch setting.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
process.chdir(root);
const { default: app } = await import('../../../server/app.ts');
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);

const testServer = express();
testServer.get('/api/v1/admin/site-settings/launch', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: true });
});
testServer.use(app);
const port = Number(new URL(process.env.BASE_URL || 'http://127.0.0.1:3000').port || 3000);
testServer.listen(port, '127.0.0.1', () => console.log(`Q test server listening on ${port}`));
