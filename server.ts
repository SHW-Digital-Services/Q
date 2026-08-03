import express from 'express';
import 'dotenv/config';
import path from 'node:path';
import { billingRouter } from './server/routes/billing';
import { aiRouter } from './server/routes/ai';
import { legalRouter } from './server/routes/legal';
import { adminRouter } from './server/routes/admin';

export const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json({
  limit: '32kb',
  verify: (request, _response, buffer) => {
    (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8');
  }
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/billing', billingRouter);
app.use('/api/q-ai', aiRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/legal', legalRouter);

if (process.env.VERCEL !== '1' && process.env.NODE_ENV === 'production') {
  const clientDirectory = path.resolve(process.cwd(), 'dist');
  app.use(express.static(clientDirectory));
  app.get(['/app', '/app/*'], (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));
}

export async function startServer() {
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  if (process.env.VERCEL !== '1') {
    app.listen(port, '0.0.0.0', () => console.log(`Q is running at http://localhost:${port}`));
  }
}

if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('[Server] Failed to start:', error);
    process.exitCode = 1;
  });
}

export default app;
