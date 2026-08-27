import express from 'express';
import 'dotenv/config';
import path from 'path';
import { billingRouter } from './routes/billing.js';
import { aiRouter } from './routes/ai.js';
import { legalRouter } from './routes/legal.js';
import { adminRouter } from './routes/admin.js';
import { referralsRouter } from './routes/referrals.js';

export const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );
  next();
});

app.use((req, _res, next) => {
  const candidates = [
    req.headers['x-invoke-path'],
    req.headers['x-forwarded-uri'],
    req.headers['x-original-url'],
    req.originalUrl,
    req.url
  ];

  for (const raw of candidates) {
    if (typeof raw === 'string' && raw) {
      const clean = raw.split('?')[0];
      if ((clean.startsWith('/api') || clean.startsWith('/legal')) &&
          !clean.endsWith('/api/index.ts') &&
          !clean.endsWith('/api/index') &&
          clean !== '/api' &&
          clean !== '/api/') {
        req.url = clean;
        break;
      }
    }
  }
  next();
});

app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Keep as string if not valid JSON.
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

app.use(['/api/billing'], billingRouter);
app.use(['/api/q-ai', '/api/ai'], aiRouter);
app.use(['/api/v1/admin', '/api/admin'], adminRouter);
app.use('/api/referrals', referralsRouter);
app.use('/legal', legalRouter);

app.use(['/api', '/api/*', '/legal', '/legal/*'], (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}` });
});

if (process.env.VERCEL !== '1' && process.env.NODE_ENV === 'production') {
  const clientDirectory = path.resolve(process.cwd(), 'dist');
  app.use(express.static(clientDirectory));
  app.get(['/app', '/app/*'], (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Uncaught Error]:', err);
  if (!res.headersSent) {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
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

export default app;
