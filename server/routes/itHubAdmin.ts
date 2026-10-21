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

itHubAdminRouter.get('/supabase-diagnostics', asyncHandler(async (req, res) => {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) return res.status(503).json({ error: 'Supabase diagnostics are not configured. Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in the server environment.' });
  if (!/^[a-z0-9]{20}$/.test(projectRef)) return res.status(503).json({ error: 'Supabase diagnostics project reference is invalid.' });

  const end = new Date();
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  const sql = 'select timestamp, id, event_message, metadata, source from logs order by timestamp desc limit 50';
  const base = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/analytics/endpoints`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const signal = AbortSignal.timeout(9000);
  try {
    const [logsResponse, metricsResponse] = await Promise.all([
      fetch(`${base}/logs?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${encodeURIComponent(start.toISOString())}&iso_timestamp_end=${encodeURIComponent(end.toISOString())}`, { headers, cache: 'no-store', signal }),
      fetch(`${base}/metrics`, { headers, cache: 'no-store', signal })
    ]);
    if (!logsResponse.ok || !metricsResponse.ok) {
      const status = !logsResponse.ok ? logsResponse.status : metricsResponse.status;
      return res.status(status === 401 || status === 403 ? 503 : 502).json({ error: status === 401 || status === 403
        ? 'Supabase rejected the diagnostics token. Check its analytics log read permission and project access.'
        : `Supabase diagnostics are temporarily unavailable (${status}).` });
    }
    const [logsPayload, metricsText] = await Promise.all([logsResponse.json(), metricsResponse.text()]);
    if (logsPayload?.error) return res.status(502).json({ error: 'Supabase could not run the recent log query.' });
    return res.json({ logs: Array.isArray(logsPayload?.result) ? logsPayload.result.slice(0, 50) : [], metrics: metricsText.slice(0, 120000), checkedAt: Date.now() });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return res.status(timeout ? 504 : 502).json({ error: timeout ? 'Supabase diagnostics took too long to load. Try again shortly.' : 'Supabase diagnostics are temporarily unavailable.' });
  }
}));

itHubAdminRouter.get('/paypal-diagnostics', asyncHandler(async (_req, res) => {
  const { serviceSupabase: db } = res.locals.itHubAdmin;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [events, payments, eventTotal, eventCompleted, eventFailed, paymentTotal, paymentCompleted, paymentFailed, paymentRefunded] = await Promise.all([
    db.from('paypal_webhook_events').select('id,event_type,status,attempt_count,claimed_at,completed_at,failed_at,last_error_code,processed_at').gte('processed_at', since).order('processed_at', { ascending: false }).limit(50),
    db.from('crm_payments').select('provider_transaction_id,status,payment_type,amount_minor,currency,occurred_at').eq('provider', 'paypal').gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(50),
    db.from('paypal_webhook_events').select('id', { count: 'exact', head: true }).gte('processed_at', since),
    db.from('paypal_webhook_events').select('id', { count: 'exact', head: true }).gte('processed_at', since).eq('status', 'completed'),
    db.from('paypal_webhook_events').select('id', { count: 'exact', head: true }).gte('processed_at', since).eq('status', 'failed'),
    db.from('crm_payments').select('id', { count: 'exact', head: true }).eq('provider', 'paypal').gte('occurred_at', since),
    db.from('crm_payments').select('id', { count: 'exact', head: true }).eq('provider', 'paypal').gte('occurred_at', since).eq('status', 'completed'),
    db.from('crm_payments').select('id', { count: 'exact', head: true }).eq('provider', 'paypal').gte('occurred_at', since).eq('status', 'failed'),
    db.from('crm_payments').select('id', { count: 'exact', head: true }).eq('provider', 'paypal').gte('occurred_at', since).eq('status', 'refunded')
  ]);
  const failures = [events, payments, eventTotal, eventCompleted, eventFailed, paymentTotal, paymentCompleted, paymentFailed, paymentRefunded].filter(result => result.error);
  if (failures.length) {
    const missing = failures.some(result => ['42P01', 'PGRST205'].includes(result.error?.code));
    return res.status(missing ? 503 : 500).json({ error: missing ? 'PayPal diagnostics storage is not configured yet. Apply the required PayPal and CRM Supabase migrations.' : 'Unable to load PayPal diagnostics.' });
  }
  return res.json({
    events: events.data ?? [],
    payments: payments.data ?? [],
    metrics: {
      days: 30,
      webhooks: { total: eventTotal.count ?? 0, completed: eventCompleted.count ?? 0, failed: eventFailed.count ?? 0 },
      payments: { total: paymentTotal.count ?? 0, completed: paymentCompleted.count ?? 0, failed: paymentFailed.count ?? 0, refunded: paymentRefunded.count ?? 0 }
    },
    checkedAt: Date.now()
  });
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

