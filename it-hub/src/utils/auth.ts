import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.IT_HUB_API_KEY;
  if (!configured) return res.status(500).json({ error: 'IT_HUB_API_KEY not configured' });

  const auth = req.headers['authorization'] as string | undefined;
  const apiKeyHeader = req.headers['x-it-hub-key'] as string | undefined;

  let supplied: string | undefined;
  if (auth && auth.startsWith('Bearer ')) supplied = auth.slice(7).trim();
  else if (apiKeyHeader) supplied = apiKeyHeader.trim();

  if (!supplied) return res.status(401).json({ error: 'missing credentials' });

  try {
    const a = Buffer.from(supplied, 'utf8');
    const b = Buffer.from(configured, 'utf8');
    if (a.length !== b.length) return res.status(401).json({ error: 'invalid credentials' });
    const ok = crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
}
