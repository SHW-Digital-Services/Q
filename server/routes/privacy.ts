import express from 'express';
import { asyncHandler, getAuthenticatedUser, sendOpaqueError } from '../middleware.js';
import { getServiceSupabase } from './admin.js';
import { hasRecentAal2, requireExactObject, writeSecurityEvent } from '../security.js';

export const privacyRouter = express.Router();

const USER_TABLES = [
  'profiles', 'memory_entries', 'journal_entries', 'daily_mood_logs', 'chat_messages',
  'subscriptions', 'crm_notes', 'crm_tasks', 'crm_payments',
  'crm_entitlements', 'crm_activities', 'referral_codes', 'referrals', 'referral_credits',
  'audit_logs'
] as const;

async function privacyContext(req: express.Request, res: express.Response) {
  const identity = await getAuthenticatedUser(req);
  if (!identity) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  const db = getServiceSupabase();
  if (!db) { res.status(503).json({ error: 'Privacy services are temporarily unavailable.' }); return null; }
  return { identity, db };
}

privacyRouter.get('/requests', asyncHandler(async (req, res) => {
  const ctx = await privacyContext(req, res); if (!ctx) return;
  const result = await ctx.db.from('privacy_requests').select('id,request_type,status,requested_at,completed_at,hold_reason,receipt_id,error_code').eq('user_id', ctx.identity.user.id).order('requested_at', { ascending: false }).limit(50);
  if (result.error) return sendOpaqueError(req, res, 503, 'Unable to retrieve privacy requests.', 'Privacy Request Status', result.error);
  return res.json({ requests: result.data ?? [] });
}));

privacyRouter.post('/export', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body ?? {}, [])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const ctx = await privacyContext(req, res); if (!ctx) return;
  if (!hasRecentAal2(req)) return res.status(403).json({ error: 'Recent multi-factor authentication is required.', code: 'AAL2_REQUIRED' });
  const created = await ctx.db.from('privacy_requests').insert({ user_id: ctx.identity.user.id, request_type: 'export', status: 'processing' }).select('id,receipt_id,requested_at').single();
  if (created.error) return sendOpaqueError(req, res, 503, 'Unable to start the data export.', 'Privacy Export Start', created.error);
  try {
    const exported: Record<string, unknown> = {
      schemaVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      identity: { id: ctx.identity.user.id, email: ctx.identity.user.email, createdAt: ctx.identity.user.created_at }
    };
    for (const table of USER_TABLES) {
      const query = ctx.db.from(table).select('*');
      const result = table === 'profiles'
        ? await query.eq('id', ctx.identity.user.id)
        : table === 'referrals'
          ? await query.or(`referrer_user_id.eq.${ctx.identity.user.id},prospect_user_id.eq.${ctx.identity.user.id}`)
          : await query.eq('user_id', ctx.identity.user.id);
      if (result.error) throw new Error(`export_${table}_failed`);
      exported[table] = result.data ?? [];
    }
    const messageIds = ((exported.chat_messages as Array<{ id: string }>) ?? []).map((row) => row.id);
    if (messageIds.length) {
      const feedback = await ctx.db.from('sentiment_feedback').select('*').in('message_id', messageIds);
      if (feedback.error) throw new Error('export_sentiment_feedback_failed');
      exported.sentiment_feedback = feedback.data ?? [];
    } else {
      exported.sentiment_feedback = [];
    }
    const completedAt = new Date().toISOString();
    await ctx.db.from('privacy_requests').update({ status: 'completed', completed_at: completedAt }).eq('id', created.data.id);
    await writeSecurityEvent(ctx.db, req, { actorId: ctx.identity.user.id, subjectId: ctx.identity.user.id, action: 'privacy.export', outcome: 'allowed', metadata: { receiptId: created.data.receipt_id } });
    return res.json({ requestId: created.data.id, receiptId: created.data.receipt_id, completedAt, data: exported });
  } catch (error) {
    await ctx.db.from('privacy_requests').update({ status: 'failed', error_code: 'EXPORT_FAILED' }).eq('id', created.data.id);
    await writeSecurityEvent(ctx.db, req, { actorId: ctx.identity.user.id, subjectId: ctx.identity.user.id, action: 'privacy.export', outcome: 'failed' });
    return sendOpaqueError(req, res, 503, 'The data export could not be completed.', 'Privacy Export', error);
  }
}));

privacyRouter.post('/deletion-requests', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['confirmation']) || req.body?.confirmation !== 'DELETE MY Q ACCOUNT') {
    return res.status(400).json({ error: 'Type DELETE MY Q ACCOUNT to confirm.' });
  }
  const ctx = await privacyContext(req, res); if (!ctx) return;
  if (!hasRecentAal2(req)) return res.status(403).json({ error: 'Recent multi-factor authentication is required.', code: 'AAL2_REQUIRED' });
  const created = await ctx.db.from('privacy_requests').insert({ user_id: ctx.identity.user.id, request_type: 'deletion', status: 'processing' }).select('id,receipt_id,requested_at').single();
  if (created.error) return sendOpaqueError(req, res, 503, 'Unable to start account deletion.', 'Privacy Deletion Start', created.error);
  const subscription = await ctx.db.from('subscriptions').select('status').eq('user_id', ctx.identity.user.id).in('status', ['ACTIVE', 'APPROVAL_PENDING', 'SUSPENDED']).limit(1).maybeSingle();
  if (subscription.error) return sendOpaqueError(req, res, 503, 'Unable to verify deletion eligibility.', 'Privacy Deletion Hold Check', subscription.error);
  if (subscription.data) {
    await ctx.db.from('privacy_requests').update({ status: 'held', hold_reason: 'An active or unsettled subscription must be resolved before account deletion.' }).eq('id', created.data.id);
    return res.status(409).json({ requestId: created.data.id, receiptId: created.data.receipt_id, status: 'held', reason: 'Resolve the active or unsettled subscription first.' });
  }
  try {
    await ctx.db.from('processor_deletion_tasks').insert([
      { privacy_request_id: created.data.id, processor: 'OpenAI', status: 'not_required', reference: 'API content is not stored by Q as a processor-side account record.' },
      { privacy_request_id: created.data.id, processor: 'PayPal', status: 'not_required', reference: 'Payment records remain with PayPal under financial retention obligations.' }
    ]);
    await writeSecurityEvent(ctx.db, req, { actorId: ctx.identity.user.id, subjectId: ctx.identity.user.id, action: 'privacy.delete', outcome: 'allowed', metadata: { receiptId: created.data.receipt_id } });
    const deleted = await ctx.db.auth.admin.deleteUser(ctx.identity.user.id);
    if (deleted.error) throw deleted.error;
    const completedAt = new Date().toISOString();
    await ctx.db.from('privacy_requests').update({ status: 'completed', completed_at: completedAt }).eq('id', created.data.id);
    return res.json({ requestId: created.data.id, receiptId: created.data.receipt_id, status: 'completed', completedAt });
  } catch (error) {
    await ctx.db.from('privacy_requests').update({ status: 'failed', error_code: 'DELETION_FAILED' }).eq('id', created.data.id);
    return sendOpaqueError(req, res, 503, 'Account deletion could not be completed.', 'Privacy Deletion', error);
  }
}));
