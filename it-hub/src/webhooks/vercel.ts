import { Request, Response } from 'express';
import { verifyVercelSignature } from '../utils/signature';
import { logEvent } from '../services/supabase_server';
import { createIncidentIfDeploymentFailed } from '../services/vercel';

export async function handleVercelWebhook(req: Request & { rawBody?: Buffer }, res: Response) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ ok: false, error: 'VERCEL_WEBHOOK_SECRET not configured' });

  const signatureHeader = (req.headers['x-vercel-signature'] || req.headers['x-signature']) as string | undefined;
  if (!signatureHeader) return res.status(400).json({ ok: false, error: 'missing signature header' });

  const raw = req.rawBody;
  if (!raw) return res.status(400).json({ ok: false, error: 'raw body missing' });

  const ok = verifyVercelSignature(secret, raw, signatureHeader);
  if (!ok) return res.status(401).json({ ok: false, error: 'invalid signature' });

  try {
    // parse JSON payload from raw buffer
    const payload = JSON.parse(raw.toString('utf8'));
    await logEvent('vercel_deployment', payload);
    await createIncidentIfDeploymentFailed(payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('vercel webhook handler error', err);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
}
