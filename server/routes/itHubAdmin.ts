import express from 'express';
import { asyncHandler } from '../middleware.js';
import { requireAdmin } from './admin.js';
import { requireExactObject } from '../security.js';
import { createIncident, getStatusPage } from '../services/itHubBetterstack.js';

export const itHubAdminRouter = express.Router();
const eventColumns = 'id,type,payload,created_at';

itHubAdminRouter.use(asyncHandler(async (req, res, next) => {
  const context = await requireAdmin(req, res);
  if (!context) return;
  res.locals.itHubAdmin = context;
  res.setHeader('Cache-Control', 'no-store');
  next();
}));

itHubAdminRouter.get('/events', asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.query.limit ?? 50);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    return res.status(400).json({ error: 'Choose an event limit from 1 to 100.' });
  }
  const { serviceSupabase: db } = res.locals.itHubAdmin;
  const { data, error } = await db.from('it_hub_events').select(eventColumns)
    .order('created_at', { ascending: false }).limit(requestedLimit);
  if (error) {
    const missing = ['42P01', 'PGRST205'].includes(error.code);
    return res.status(missing ? 503 : 500).json({ error: missing
      ? 'IT Hub event storage is not configured yet. Apply the IT Hub Supabase migration.'
      : 'Unable to load IT Hub events.' });
  }
  return res.json({ events: data ?? [] });
}));

itHubAdminRouter.get('/status-page', asyncHandler(async (_req, res) => {
  if (!process.env.BETTERSTACK_API_KEY) return res.status(503).json({ error: 'BetterStack is not configured.' });
  try {
    return res.json({ statusPage: await getStatusPage() });
  } catch (error) {
    console.error('[IT Hub] Status page request failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(502).json({ error: 'Unable to load the BetterStack status page.' });
  }
}));

itHubAdminRouter.post('/incidents', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['title', 'details']) || typeof req.body.title !== 'string' || req.body.title.trim().length < 3 || req.body.title.trim().length > 180 || typeof req.body.details !== 'string' || req.body.details.trim().length > 5000) {
    return res.status(400).json({ error: 'Enter an incident title (3–180 characters) and details (up to 5,000 characters).' });
  }
  if (!process.env.BETTERSTACK_API_KEY) return res.status(503).json({ error: 'BetterStack is not configured.' });
  const { serviceSupabase: db, identity } = res.locals.itHubAdmin;
  const requesterEmail = identity.user.email || process.env.BETTERSTACK_REQUESTER_EMAIL;
  if (!requesterEmail) return res.status(503).json({ error: 'Set an email for the signed-in admin or configure BETTERSTACK_REQUESTER_EMAIL.' });
  try {
    const incident = await createIncident({
      title: req.body.title.trim(),
      details: req.body.details.trim() || undefined,
      requesterEmail
    });
    const { error } = await db.from('it_hub_events').insert([{
      type: 'incident_created', payload: { incident, actor_id: identity.user.id }
    }]);
    if (error) console.error('[IT Hub] Incident event logging failed:', error.code || 'DatabaseError');
    return res.status(201).json({ incident });
  } catch (error) {
    console.error('[IT Hub] Incident creation failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(502).json({ error: 'Unable to create the BetterStack incident.' });
  }
}));

