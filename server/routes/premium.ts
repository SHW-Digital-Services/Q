import express from 'express';
import { asyncHandler, getAuthenticatedUser } from '../middleware.js';
import { getServiceSupabase } from './admin.js';
import { hasPremium, programmes, journalInsights, validSnapshot } from '../premium-domain.js';

export function createPremiumRouter(dependencies = {getAuthenticatedUser,getServiceSupabase}) {
const premiumRouter = express.Router();
premiumRouter.use(asyncHandler(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const identity = await dependencies.getAuthenticatedUser(req);
  if (!identity) return res.status(401).json({ error: 'Sign in to continue.' });
  const db = dependencies.getServiceSupabase();
  if (!db) return res.status(503).json({ error: 'Premium access is temporarily unavailable.' });
  const [subscription, profile] = await Promise.all([
    db.from('subscriptions').select('status,current_period_end').eq('user_id',identity.user.id).maybeSingle(),
    db.from('profiles').select('role').eq('id',identity.user.id).maybeSingle()
  ]);
  if (subscription.error || profile.error) return res.status(503).json({ error: 'Unable to verify premium access.' });
  res.locals.premium = hasPremium(subscription.data, profile.data?.role);
  res.locals.userId = identity.user.id; res.locals.db = db;
  next();
}));
premiumRouter.get('/access', (_req,res) => res.json({ premium:res.locals.premium }));
// Reading/exporting and deleting your existing cloud copy remain available after expiry.
premiumRouter.get('/continuity', asyncHandler(async (_req,res) => {
  const {data,error} = await res.locals.db.from('premium_continuity').select('payload,revision,updated_at').eq('user_id',res.locals.userId).maybeSingle();
  if(error) return res.status(503).json({error:'Cloud continuity is unavailable. Your local data is unchanged.'});
  res.json(data || {payload:null,revision:0});
}));
premiumRouter.delete('/continuity', asyncHandler(async (_req,res) => {
  const {error} = await res.locals.db.from('premium_continuity').delete().eq('user_id',res.locals.userId);
  if(error) return res.status(503).json({error:'Unable to remove the cloud copy.'});
  res.json({deleted:true});
}));
premiumRouter.use((_req,res,next) => res.locals.premium ? next() : res.status(403).json({error:'This feature requires Q Premium.'}));
premiumRouter.get('/programmes', (_req,res) => res.json(programmes));
premiumRouter.post('/insights', (req,res) => {
  const {records,days} = req.body || {};
  if (![30,90,365].includes(days) || !Array.isArray(records) || records.length > 10000 || records.some(r => !r || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5 || !Array.isArray(r.tags) || r.tags.length > 30 || r.tags.some((t:unknown) => typeof t !== 'string' || t.length > 80))) return res.status(400).json({error:'Invalid insight data.'});
  res.json(journalInsights(records,days));
});
premiumRouter.put('/continuity', asyncHandler(async (req,res) => {
  const {payload,revision} = req.body || {};
  if (!Number.isSafeInteger(revision) || revision < 0 || !validSnapshot(payload) || Buffer.byteLength(JSON.stringify(payload)) > 900000) return res.status(400).json({error:'Invalid or oversized continuity data (maximum 900 KB).'});
  const {data,error} = await res.locals.db.rpc('save_premium_continuity',{owner_id:res.locals.userId,expected_revision:revision,new_payload:payload});
  if(error) return res.status(503).json({error:'Unable to save the cloud copy. Your local data is unchanged.'});
  if(!data) return res.status(409).json({error:'Another device changed your cloud copy. Review the conflict before syncing.'});
  res.json({revision:data});
}));
return premiumRouter;
}
export const premiumRouter = createPremiumRouter();
