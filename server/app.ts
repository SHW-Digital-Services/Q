import express from 'express';
import 'dotenv/config';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { billingRouter } from './routes/billing.js';
import { aiRouter } from './routes/ai.js';
import { legalRouter } from './routes/legal.js';
import { adminRouter } from './routes/admin.js';
import { getServiceSupabase } from './routes/admin.js';
import { referralsRouter } from './routes/referrals.js';
import { createRateLimitMiddleware } from './security.js';
import { privacyRouter } from './routes/privacy.js';
import { premiumRouter } from './routes/premium.js';
import { contentRouter } from './routes/content.js';
import { peerKnowledgeRouter } from './routes/peerKnowledge.js';
import { lifeGuidesRouter } from './routes/lifeGuides.js';
import { helpVideosRouter, helpVideosAdminRouter } from './routes/helpVideos.js';
import { brevoWebhookReceiver, brevoWebhookAdminRouter } from './routes/brevoWebhooks.js';
import { commsRouter } from './routes/comms.js';
import { adminDeleteUsersRouter } from './routes/adminDeleteUsers.js';
import { onlinePresenceRouter } from './routes/onlinePresence.js';

export const app = express();
const port = Number(process.env.PORT ?? 3000);

type DependencyState = 'up' | 'down' | 'not_configured';

type SupabaseHealth = {
  status: 'ok' | 'down';
  services: {
    database: DependencyState;
    auth: DependencyState;
  };
  timestamp: string;
};

async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  const timestamp = new Date().toISOString();
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: 'down',
      services: { database: 'not_configured', auth: 'not_configured' },
      timestamp
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const check = async (dependencyPath: string): Promise<DependencyState> => {
    try {
      const response = await fetch(`${supabaseUrl}${dependencyPath}`, {
        headers: { apikey: supabaseAnonKey },
        signal: controller.signal
      });
      return response.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  };

  try {
    const [auth, database] = await Promise.all([
      check('/auth/v1/health'),
      check('/rest/v1/site_settings?select=key&limit=1')
    ]);
    const isHealthy = auth === 'up' && database === 'up';
    return {
      status: isHealthy ? 'ok' : 'down',
      services: { database, auth },
      timestamp
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.disable('x-powered-by');

const trustedProxy = process.env.TRUSTED_PROXY?.trim();
if (trustedProxy) {
  if (!/^(loopback|linklocal|uniquelocal|\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?)$/.test(trustedProxy)) {
    throw new Error('TRUSTED_PROXY must be a named local range or a single IPv4/CIDR value.');
  }
  app.set('trust proxy', trustedProxy);
} else {
  app.set('trust proxy', false);
}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src https://cdn.brevo.com https://sibautomation.com 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval' blob: https://conversations-widget.brevo.com https://fe-conversations-widget.brevo.com; frame-src https://sibautomation.com 'self' https://www.youtube-nocookie.com https://conversations-widget.brevo.com https://fe-conversations-widget.brevo.com; media-src 'self' https://*.supabase.co; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fe-conversations-widget.brevo.com; img-src 'self' data: blob: https:; font-src 'self' data: https://designsystem.brevo.com; connect-src https://cdn.brevo.com https://sibautomation.com https://in-automate.brevo.com 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com https://conversations-widget.brevo.com https://fe-conversations-widget.brevo.com;");
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );
  next();
});

app.use((req, res, next) => {
  if (/^\/api\/(?:q-ai|ai|billing|v1\/admin|admin|referrals|privacy|premium)(?:\/|$)/.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

app.use('/api', createRateLimitMiddleware(getServiceSupabase));

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
    limit: req.path.startsWith('/api/comms/') ? '256kb' : req.path.startsWith('/api/webhooks/brevo/') ? '256kb' : req.path.startsWith('/api/premium/') ? '1mb' : /^\/api\/(?:v1\/)?admin\/help-videos(?:\/|$)/.test(req.path) ? '512kb' : '32kb',
    verify: (request, _response, buffer) => {
      if (!request.url?.startsWith('/api/comms/')) (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8');
    }
  })(req, res, next);
});

app.get('/api/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const supabase = await checkSupabaseHealth();
  return res.status(supabase.status === 'ok' ? 200 : 503).json({
    status: supabase.status,
    services: {
      api: 'up',
      database: supabase.services.database,
      auth: supabase.services.auth
    },
    timestamp: supabase.timestamp
  });
});

app.get('/api/health/supabase', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const supabase = await checkSupabaseHealth();
  return res.status(supabase.status === 'ok' ? 200 : 503).json(supabase);
});

app.use(['/api/billing'], billingRouter);
app.use('/api/comms', commsRouter);
app.use('/api/presence', onlinePresenceRouter);
app.use(['/api/q-ai', '/api/ai'], aiRouter);
app.use(['/api/v1/admin', '/api/admin'], adminRouter);
app.use(['/api/v1/admin/delete-users', '/api/admin/delete-users'], adminDeleteUsersRouter);
app.use(['/api/v1/admin/help-videos', '/api/admin/help-videos'], helpVideosAdminRouter);
app.use(['/api/v1/admin/brevo-webhooks', '/api/admin/brevo-webhooks'], brevoWebhookAdminRouter);
app.use('/api/webhooks/brevo', brevoWebhookReceiver);
app.use('/api/referrals', referralsRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/premium', premiumRouter);
app.use('/api/content', contentRouter);
app.use('/api/peer-knowledge', peerKnowledgeRouter);
app.use('/api/life-guides', lifeGuidesRouter);
app.use('/api/help-videos', helpVideosRouter);
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

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = randomUUID();
  const mailRequest = req.path.startsWith('/api/comms/');
  if (!mailRequest && err?.type !== 'entity.parse.failed') console.error(`[Server Uncaught Error] requestId=${requestId}:`, err instanceof Error ? err.message : err);
  if (!res.headersSent) {
    res.setHeader('X-Request-Id', requestId);
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Send a valid JSON request.' });
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    res.status(500).json({ error: 'An unexpected server error occurred.', requestId });
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
