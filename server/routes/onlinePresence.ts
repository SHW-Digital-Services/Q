import express from 'express';
import { getAuthenticatedUser, asyncHandler, sendOpaqueError } from '../middleware.js';
import { getServiceSupabase } from './admin.js';
import { requireExactObject } from '../security.js';
import { onlineRole, presenceTopics, readableTopics, type OnlineUser } from '../../src/shared/onlinePresence.js';
import { presenceSigningKey, signPresenceTicket, verifyPresenceTicket, presenceDisplayName } from '../onlinePresence.js';

type Dependencies = {
  authenticate: typeof getAuthenticatedUser;
  serviceDb: typeof getServiceSupabase;
  signingKey: () => Buffer | null;
  now: () => number;
};

export function createOnlinePresenceRouter(overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    authenticate: getAuthenticatedUser, serviceDb: getServiceSupabase, now: Date.now,
    signingKey: () => {
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      return secret ? presenceSigningKey(secret) : null;
    }, ...overrides,
  };
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  async function context(req: express.Request, res: express.Response) {
    const identity = await deps.authenticate(req);
    if (!identity) { res.status(401).json({ error: 'Please sign in to use online status.' }); return null; }
    const db = deps.serviceDb(); const key = deps.signingKey();
    if (!db || !key) { res.status(503).json({ error: 'Online status is temporarily unavailable.' }); return null; }
    const { data: profile, error } = await db.from('profiles').select('role').eq('id', identity.user.id).maybeSingle();
    if (error) { sendOpaqueError(req, res, 503, 'Online status is temporarily unavailable.', 'Online presence profile', error); return null; }
    const role = profile && onlineRole(profile.role);
    if (!role) { res.status(403).json({ error: 'Online status is unavailable for this account.' }); return null; }
    return { db, key, role, userId: identity.user.id };
  }

  router.get('/me', asyncHandler(async (req, res) => {
    const ctx = await context(req, res); if (!ctx) return;
    return res.json({ user_id: ctx.userId, role: ctx.role, publishTopic: presenceTopics[ctx.role],
      readTopics: readableTopics(ctx.role), ticket: signPresenceTicket(ctx.userId, ctx.role, ctx.key, deps.now()) });
  }));

  router.post('/resolve', asyncHandler(async (req, res) => {
    const ctx = await context(req, res); if (!ctx) return;
    if (ctx.role === 'customer') return res.status(403).json({ error: 'Staff access is required to view online users.' });
    if (!requireExactObject(req.body, ['tickets']) || !Array.isArray(req.body.tickets) || req.body.tickets.length > 75 ||
      req.body.tickets.some((ticket: unknown) => typeof ticket !== 'string' || ticket.length > 600)) {
      return res.status(400).json({ error: 'Send up to 75 valid presence tickets.' });
    }
    const valid = new Map<string, ReturnType<typeof verifyPresenceTicket>>();
    for (const value of req.body.tickets) {
      const ticket = verifyPresenceTicket(value, ctx.key, deps.now());
      if (ticket && (ctx.role === 'admin' || ticket.role === 'customer')) valid.set(ticket.user_id, ticket);
    }
    if (!valid.size) return res.json({ users: [] });
    let query = ctx.db.from('profiles').select('id,preferred_name,role').in('id', [...valid.keys()]);
    if (ctx.role === 'staff') query = query.in('role', ['user', 'beta_tester']);
    const { data: profiles, error } = await query;
    if (error) return sendOpaqueError(req, res, 503, 'Could not load online users.', 'Online presence list', error);
    const users: OnlineUser[] = [];
    for (const profile of profiles || []) {
      const role = onlineRole(profile.role);
      if (role && role === valid.get(profile.id)?.role && (ctx.role === 'admin' || role === 'customer')) {
        users.push({ user_id: profile.id, display_name: presenceDisplayName(profile), role });
      }
    }
    users.sort((a, b) => a.display_name.localeCompare(b.display_name));
    return res.json({ users });
  }));
  return router;
}

export const onlinePresenceRouter = createOnlinePresenceRouter();
