import express from 'express';
import { getAuthenticatedUser, asyncHandler, getRequestId } from '../middleware.js';
import { getServiceSupabase, requireAdmin } from './admin.js';
import { requireExactObject } from '../security.js';

export const userActivityRouter = express.Router();

const allowedActions = new Set(['ui.click', 'ui.page_view', 'ui.submit', 'ui.change']);
const safeText = (value: unknown, maximum: number) => typeof value === 'string' && value.length <= maximum && !/[\r\n<>]/.test(value);

userActivityRouter.post('/events', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireExactObject(req.body, ['events', 'visitorId']) || !Array.isArray(req.body.events) || req.body.events.length < 1 || req.body.events.length > 25) {
    return res.status(400).json({ error: 'Invalid activity batch.' });
  }
  const visitorId = req.body.visitorId;
  if (typeof visitorId !== 'string' || !/^[0-9a-f-]{36}$/i.test(visitorId)) return res.status(400).json({ error: 'Invalid visitor identifier.' });
  const events = req.body.events as unknown[];
  const rows = [];
  for (const item of events) {
    if (!requireExactObject(item, ['action', 'page', 'target', 'element'])) return res.status(400).json({ error: 'Invalid activity event.' });
    const event = item as Record<string, unknown>;
    if (typeof event.action !== 'string' || !allowedActions.has(event.action) || !safeText(event.page, 200) || !safeText(event.target, 100) || !safeText(event.element, 40)) {
      return res.status(400).json({ error: 'Invalid activity event.' });
    }
    rows.push({ action: event.action, page: event.page, target: event.target, element: event.element });
  }

  const identity = await getAuthenticatedUser(req);
  const db = getServiceSupabase();
  if (!db) return res.status(503).json({ error: 'Activity logging is temporarily unavailable.' });
  const requestId = getRequestId(req);
  const { error } = await db.from('security_events').insert(rows.map((event) => ({
    actor_id: identity?.user.id ?? null,
    action: event.action,
    outcome: 'allowed',
    request_id: requestId,
    metadata: { source: 'ui', visitorId, page: event.page, target: event.target, element: event.element }
  })));
  if (error) {
    console.error(`[Activity Audit] requestId=${requestId}`, error.message);
    return res.status(503).json({ error: 'Activity logging is temporarily unavailable.' });
  }
  return res.status(202).json({ accepted: rows.length });
}));

userActivityRouter.get('/audit-log', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const limitValue = Number(req.query.limit ?? 100);
  const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 100;
  const beforeTime = typeof req.query.beforeTime === 'string' && !Number.isNaN(Date.parse(req.query.beforeTime)) ? req.query.beforeTime : null;
  const beforeId = typeof req.query.beforeId === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.beforeId) ? req.query.beforeId : null;
  let query = admin.serviceSupabase.from('security_events')
    .select('id,occurred_at,actor_id,subject_id,action,outcome,request_id,metadata')
    .order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (beforeTime && beforeId) query = query.or(`occurred_at.lt.${beforeTime},and(occurred_at.eq.${beforeTime},id.lt.${beforeId})`);
  const { data, error } = await query;
  if (error) {
    console.error(`[Admin Audit Log] requestId=${getRequestId(req)}`, error.message);
    return res.status(503).json({ error: 'Could not load the audit log.' });
  }
  return res.json({ events: data ?? [] });
}));
