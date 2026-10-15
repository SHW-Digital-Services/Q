import { Request, Response } from 'express';
import { verifySignature } from '../utils/signature';
import { logEvent } from '../services/supabase';
import { createIncidentIfDeploymentFailed } from '../services/vercel';

export async function handleVercelWebhook(req: Request, res: Response) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const signatureHeader = (req.headers['x-signature'] || req.headers['x-vercel-signature'] || req.headers['x-hub-signature']) as string | undefined;

  if (secret && signatureHeader) {
    const ok = verifySignature(secret, JSON.stringify(req.body), signatureHeader);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid signature' });
  }

  try {
    await logEvent('vercel_deployment', req.body);
    await createIncidentIfDeploymentFailed(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('vercel webhook handler error', err);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
}
