import express from 'express';
import 'dotenv/config';
import path from 'node:path';
import { billingRouter } from './server/routes/billing';
import { aiRouter } from './server/routes/ai';
import { legalRouter } from './server/routes/legal';
import { adminRouter } from './server/routes/admin';

export const app = express();
const port = Number(process.env.PORT ?? 3000);

// Normalize incoming URL path for Vercel/serverless rewrites
app.use((req, _res, next) => {
  if (req.url === '/api' || req.url === '/api/' || req.url.startsWith('/api/index') || req.url === '/') {
    const original = req.originalUrl || (req.headers['x-forwarded-uri'] as string);
    if (original && (original.startsWith('/api') || original.startsWith('/legal'))) {
      req.url = original.split('?')[0];
    }
  }
  next();
});

// Safe body parsing middleware that handles both standalone Express and pre-parsed Serverless environments
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Keep as string if not valid JSON
      }
    }
    return next();
  }
  express.json({
    limit: '32kb',
    verify: (request, _response, buffer) => {
      (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8');
    }
  })(req, res, next);
});

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

// Global Express error handler to guarantee valid JSON responses
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Uncaught Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'An unexpected server error occurred.' });
  }
});

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

const isMainModule = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs') || process.argv[1].endsWith('server.js'))
);

if (isMainModule && process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('[Server] Failed to start:', error);
    process.exitCode = 1;
  });
}

export default app;
