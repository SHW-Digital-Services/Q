import express from 'express';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { asyncHandler, getAuthenticatedUser, getCanonicalAppUrl } from '../middleware.js';
import { requireExactObject } from '../security.js';

export const referralsRouter = express.Router();

function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function context(req: express.Request, res: express.Response) {
  const identity = await getAuthenticatedUser(req);
  if (!identity) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  const db = serviceClient();
  if (!db) { res.status(503).json({ error: 'Referral service is not configured.' }); return null; }
  return { identity, db };
}

async function ensureCode(db: any, userId: string) {
  const existing = await db.from('referral_codes').select('code').eq('user_id', userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.code as string;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString('hex').toUpperCase();
    const created = await db.from('referral_codes').insert({ user_id: userId, code }).select('code').single();
    if (!created.error) return created.data.code as string;
    if (created.error.code !== '23505') throw created.error;
  }
  throw new Error('Unable to generate a unique referral code.');
}

referralsRouter.get('/me', asyncHandler(async (req, res) => {
  const ctx = await context(req, res); if (!ctx) return;
  const code = await ensureCode(ctx.db, ctx.identity.user.id);
  await ctx.db.from('referral_credits').update({ status: 'available' }).eq('user_id', ctx.identity.user.id).eq('status', 'pending').lte('available_at', new Date().toISOString());
  await ctx.db.from('referral_credits').update({ status: 'expired' }).eq('user_id', ctx.identity.user.id).in('status', ['pending','available']).lt('expires_at', new Date().toISOString());
  const [referrals, credits] = await Promise.all([
    ctx.db.from('referrals').select('id,prospect_email,status,signed_up_at,qualified_at,created_at').eq('referrer_user_id', ctx.identity.user.id).order('created_at', { ascending: false }),
    ctx.db.from('referral_credits').select('id,kind,amount_minor,currency,status,available_at,expires_at,note,created_at').eq('user_id', ctx.identity.user.id).order('created_at', { ascending: false })
  ]);
  if (referrals.error || credits.error) throw referrals.error || credits.error;
  const balance = (credits.data ?? []).filter((row:any) => row.status === 'available' || (row.status === 'used' && row.kind === 'redemption')).reduce((sum:number,row:any) => sum + row.amount_minor, 0);
  const base = getCanonicalAppUrl();
  return res.json({ code, referralUrl: `${base}/?ref=${code}`, balanceMinor: Math.max(0, balance), currency: 'GBP', referrals: referrals.data, credits: credits.data });
}));

referralsRouter.post('/invite', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['email'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const ctx = await context(req, res); if (!ctx) return;
  const prospectEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(prospectEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (prospectEmail === String(ctx.identity.user.email || '').toLowerCase()) return res.status(400).json({ error: 'You cannot refer yourself.' });
  const code = await ensureCode(ctx.db, ctx.identity.user.id);
  let accountExists = false;
  for (let page = 1; page <= 100; page += 1) {
    const existingUsers = await ctx.db.auth.admin.listUsers({ page, perPage: 1000 });
    if (existingUsers.error) throw existingUsers.error;
    if (existingUsers.data.users.some((user:any) => String(user.email).toLowerCase() === prospectEmail)) { accountExists = true; break; }
    if (existingUsers.data.users.length < 1000) break;
  }
  if (accountExists) return res.status(409).json({ error: 'That email already has a Q account.' });
  const result = await ctx.db.from('referrals').insert({ referrer_user_id: ctx.identity.user.id, prospect_email: prospectEmail }).select().single();
  if (result.error?.code === '23505') return res.status(409).json({ error: 'You have already referred that email address.' });
  if (result.error) throw result.error;
  return res.status(201).json({ referral: result.data, referralUrl: `${getCanonicalAppUrl()}/?ref=${code}` });
}));

referralsRouter.post('/claim', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['code'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const ctx = await context(req, res); if (!ctx) return;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Referral code is required.' });
  const owner = await ctx.db.from('referral_codes').select('user_id').eq('code', code).maybeSingle();
  if (!owner.data) return res.status(404).json({ error: 'Referral code was not found.' });
  if (owner.data.user_id === ctx.identity.user.id) return res.status(400).json({ error: 'You cannot refer yourself.' });
  const email = String(ctx.identity.user.email || '').toLowerCase();
  const referral = await ctx.db.from('referrals').select('*').eq('referrer_user_id', owner.data.user_id).eq('prospect_email', email).maybeSingle();
  if (!referral.data) return res.status(403).json({ error: 'This referral link was not issued to your email address.' });
  if (referral.data.prospect_user_id && referral.data.prospect_user_id !== ctx.identity.user.id) return res.status(409).json({ error: 'This referral has already been claimed.' });
  const updated = await ctx.db.from('referrals').update({ prospect_user_id: ctx.identity.user.id, status: 'signed_up', signed_up_at: new Date().toISOString() }).eq('id', referral.data.id).select().single();
  if (updated.error) throw updated.error;
  return res.json({ claimed: true });
}));
