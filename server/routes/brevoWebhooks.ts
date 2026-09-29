import express from 'express';
import { asyncHandler, getCanonicalAppUrl, sendOpaqueError } from '../middleware.js';
import { getServiceSupabase, requireAdmin } from './admin.js';
import { isUuid, requireExactObject } from '../security.js';
import { hashWebhookToken, newIntegrationAddress, newWebhookToken, normaliseBrevoEvents } from '../brevoWebhooks.js';

const endpointColumns = 'id,name,webhook_type,integration_address,token_prefix,active,created_at,updated_at,last_received_at';
const eventColumns = 'id,endpoint_id,event_type,email,status,received_at,reviewed_at';
const pageSize = 50;
type Dependencies = { getDb: () => any; authoriseAdmin: typeof requireAdmin; baseUrl: () => string };

export function createBrevoWebhookRouters(dependencies: Dependencies) {
  const receiver = express.Router();
  const admin = express.Router();
  const endpointWithUrl = (endpoint: any) => ({ ...endpoint, url: `${dependencies.baseUrl()}/api/webhooks/brevo/${endpoint.id}` });
  const databaseError = (req: express.Request, res: express.Response, error: any, action: string) => {
    const missing = ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code);
    return sendOpaqueError(req, res, missing ? 503 : 500, missing ? 'Brevo webhooks are not configured yet. Apply the incoming webhooks migration.' : 'Unable to complete the webhook request.', action, { code: error?.code });
  };
  receiver.post('/:id', asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.headers.authorization?.match(/^Bearer\s+(q_brevo_[A-Za-z0-9_-]{43})$/i)?.[1];
    if (!isUuid(req.params.id) || !token) return res.status(401).json({ error: 'Valid webhook authentication is required.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Send webhook events as application/json.' });
    const db = dependencies.getDb();
    if (!db) return res.status(503).json({ error: 'Webhook receiving is temporarily unavailable.' });
    // Check before parsing/storing payloads; the RPC repeats this under a lock.
    const auth = await db.from('brevo_webhook_endpoints').select('id').eq('id', req.params.id).eq('active', true).eq('token_hash', hashWebhookToken(token)).maybeSingle();
    if (auth.error) return databaseError(req, res, auth.error, 'Brevo Webhook Authorisation');
    if (!auth.data) return res.status(401).json({ error: 'Valid webhook authentication is required.' });
    let events: ReturnType<typeof normaliseBrevoEvents>;
    try { events = normaliseBrevoEvents(req.body); }
    catch (error: any) { return res.status(400).json({ error: error.message }); }
    const { data, error } = await db.rpc('receive_brevo_webhook', { p_endpoint_id: req.params.id, p_token_hash: hashWebhookToken(token), p_events: events });
    if (error) return databaseError(req, res, error, 'Brevo Webhook Receive');
    if (!data?.authorised) return res.status(401).json({ error: 'Valid webhook authentication is required.' });
    return res.status(200).json({ received: data.received, duplicates: data.duplicates });
  }));
  admin.use(asyncHandler(async (req, res, next) => {
    const context = await dependencies.authoriseAdmin(req, res); if (!context) return;
    res.locals.webhookAdmin = context;
    res.setHeader('Cache-Control', 'no-store'); next();
  }));
  admin.get('/endpoints', asyncHandler(async (req, res) => {
    const { serviceSupabase: db } = res.locals.webhookAdmin;
    const { data, error } = await db.from('brevo_webhook_endpoints').select(endpointColumns).order('created_at', { ascending: false });
    if (error) return databaseError(req, res, error, 'Webhook Endpoint List');
    return res.json({ endpoints: (data ?? []).map(endpointWithUrl) });
  }));
  admin.post('/endpoints', asyncHandler(async (req, res) => {
    if (!requireExactObject(req.body, ['name', 'webhookType']) || typeof req.body.name !== 'string' || req.body.name.trim().length < 3 || req.body.name.trim().length > 120 || !['transactional', 'marketing', 'other'].includes(req.body.webhookType)) return res.status(400).json({ error: 'Enter a name (3–120 characters) and choose a webhook type.' });
    const { serviceSupabase: db, identity } = res.locals.webhookAdmin;
    const secret = newWebhookToken();
    const { data, error } = await db.from('brevo_webhook_endpoints').insert({ name: req.body.name.trim(), webhook_type: req.body.webhookType, integration_address: newIntegrationAddress(), token_hash: secret.token_hash, token_prefix: secret.token_prefix, created_by: identity.user.id, updated_by: identity.user.id }).select(endpointColumns).single();
    if (error) return databaseError(req, res, error, 'Webhook Endpoint Create');
    return res.status(201).json({ endpoint: endpointWithUrl(data), token: secret.token });
  }));
  admin.patch('/endpoints/:id', asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id) || !requireExactObject(req.body, ['active']) || typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Supply a valid endpoint and enabled state.' });
    const { serviceSupabase: db, identity } = res.locals.webhookAdmin;
    const { data, error } = await db.from('brevo_webhook_endpoints').update({ active: req.body.active, updated_by: identity.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select(endpointColumns).maybeSingle();
    if (error) return databaseError(req, res, error, 'Webhook Endpoint Update');
    if (!data) return res.status(404).json({ error: 'Webhook endpoint not found.' });
    return res.json({ endpoint: endpointWithUrl(data) });
  }));
  admin.post('/endpoints/:id/rotate', asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id) || !requireExactObject(req.body ?? {}, [])) return res.status(400).json({ error: 'Supply a valid endpoint without extra fields.' });
    const { serviceSupabase: db, identity } = res.locals.webhookAdmin;
    const secret = newWebhookToken();
    const { data, error } = await db.from('brevo_webhook_endpoints').update({ token_hash: secret.token_hash, token_prefix: secret.token_prefix, updated_by: identity.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select(endpointColumns).maybeSingle();
    if (error) return databaseError(req, res, error, 'Webhook Secret Rotate');
    if (!data) return res.status(404).json({ error: 'Webhook endpoint not found.' });
    return res.json({ endpoint: endpointWithUrl(data), token: secret.token });
  }));
  admin.get('/events', asyncHandler(async (req, res) => {
    const endpointId = String(req.query.endpointId ?? '');
    const status = String(req.query.status ?? 'all');
    if ((endpointId && !isUuid(endpointId)) || !['all', 'received', 'reviewed'].includes(status)) return res.status(400).json({ error: 'Invalid event filter.' });
    const requestedOffset = Number(req.query.offset ?? 0);
    const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
    const { serviceSupabase: db } = res.locals.webhookAdmin;
    let query = db.from('brevo_webhook_events').select(eventColumns).order('received_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize - 1);
    if (endpointId) query = query.eq('endpoint_id', endpointId);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return databaseError(req, res, error, 'Webhook Event List');
    return res.json({ events: data ?? [], hasMore: data?.length === pageSize });
  }));
  admin.get('/events/:id', asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid event ID.' });
    const { serviceSupabase: db } = res.locals.webhookAdmin;
    const { data, error } = await db.from('brevo_webhook_events').select(`${eventColumns},payload`).eq('id', req.params.id).maybeSingle();
    if (error) return databaseError(req, res, error, 'Webhook Event Detail');
    if (!data) return res.status(404).json({ error: 'Webhook event not found.' });
    return res.json({ event: data });
  }));
  admin.patch('/events/:id', asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id) || !requireExactObject(req.body, ['status']) || !['received', 'reviewed'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid event or review status.' });
    const { serviceSupabase: db, identity } = res.locals.webhookAdmin;
    const reviewed = req.body.status === 'reviewed';
    const { data, error } = await db.from('brevo_webhook_events').update({ status: req.body.status, reviewed_at: reviewed ? new Date().toISOString() : null, reviewed_by: reviewed ? identity.user.id : null }).eq('id', req.params.id).select(eventColumns).maybeSingle();
    if (error) return databaseError(req, res, error, 'Webhook Event Review');
    if (!data) return res.status(404).json({ error: 'Webhook event not found.' });
    return res.json({ event: data });
  }));
  return { receiver, admin };
}
const routers = createBrevoWebhookRouters({ getDb: getServiceSupabase, authoriseAdmin: requireAdmin, baseUrl: getCanonicalAppUrl });
export const brevoWebhookReceiver = routers.receiver;
export const brevoWebhookAdminRouter = routers.admin;
