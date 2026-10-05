import express from 'express';
import { asyncHandler } from '../middleware.js';
import { buildCommunityNewsletter, deliverCommunityNewsletter } from '../communityNewsletter.js';

export const communityNewsletterRouter = express.Router();

function authorised(req: express.Request) {
  const expected = process.env.COMMUNITY_NEWSLETTER_WEBHOOK_SECRET;
  const actual = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(expected && actual && actual === expected);
}

communityNewsletterRouter.post('/run', asyncHandler(async (req, res) => {
  if (!authorised(req)) return res.status(401).json({ error: 'Unauthorised.' });
  const preview = req.query.preview === 'true' || req.body?.preview === true;
  const payload = await buildCommunityNewsletter(typeof req.body?.month === 'string' ? req.body.month : undefined, { award: !preview });
  if (!preview) {
    try { await deliverCommunityNewsletter(payload); }
    catch (error: any) { console.error('[Community newsletter] Slack delivery failed:', error); return res.status(502).json({ error: 'Newsletter was awarded but Slack delivery failed.' }); }
  }
  return res.json({ success: true, preview, payload });
}));
