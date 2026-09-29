import express from 'express';
import { asyncHandler, sendOpaqueError } from '../middleware.js';
import { requireAdmin } from './admin.js';
import { isUuid, requireExactObject, writeSecurityEvent } from '../security.js';

export function createAdminDeleteUsersRouter(authoriseAdmin: typeof requireAdmin = requireAdmin) {
  const router = express.Router();
  router.delete('/:id', asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const context = await authoriseAdmin(req, res); if (!context) return;
    const { serviceSupabase: db, identity } = context;
    if (!isUuid(req.params.id) || !requireExactObject(req.body, ['confirmation']) || typeof req.body.confirmation !== 'string') return res.status(400).json({ error: 'Confirm the account email address before deleting.' });
    if (req.params.id === identity.user.id) return res.status(409).json({ error: 'You cannot delete your own account from the CRM.' });
    const [auth, profile, subscriptions] = await Promise.all([
      db.auth.admin.getUserById(req.params.id),
      db.from('profiles').select('role').eq('id', req.params.id).maybeSingle(),
      db.from('subscriptions').select('status').eq('user_id', req.params.id)
    ]);
    if (auth.error || !auth.data?.user) return res.status(404).json({ error: 'User not found.' });
    if (profile.error || subscriptions.error) return res.status(503).json({ error: 'Unable to verify whether this account can be deleted.' });
    // An admin must first intentionally remove another admin's role. This also
    // prevents deleting the last administrator through this operation.
    if (!profile.data || profile.data.role === 'partner_admin') return res.status(409).json({ error: 'Admin accounts cannot be deleted here. Change their role first using another admin account.' });
    const email = auth.data.user.email;
    if (!email || req.body.confirmation.trim() !== email) return res.status(400).json({ error: 'Type the exact account email address to confirm deletion.' });
    if ((subscriptions.data || []).some(s => !['CANCELLED', 'EXPIRED'].includes(s.status))) return res.status(409).json({ error: 'Resolve or cancel this account’s PayPal subscription before deleting the user. Deleting a Q user does not cancel payments in PayPal.' });
    await writeSecurityEvent(db, req, { actorId: identity.user.id, subjectId: req.params.id, action: 'admin.user.delete', outcome: 'allowed' });
    const result = await db.auth.admin.deleteUser(req.params.id, false);
    if (result.error) {
      await writeSecurityEvent(db, req, { actorId: identity.user.id, subjectId: req.params.id, action: 'admin.user.delete', outcome: 'failed' });
      return sendOpaqueError(req, res, 503, 'The account could not be deleted. Check retained records and owned storage before trying again.', 'Admin User Deletion', { code: result.error.code });
    }
    // The subject FK may have been cleared by deletion; record completion
    // against the surviving admin with a technical identifier, without email.
    await writeSecurityEvent(db, req, { actorId: identity.user.id, action: 'admin.user.deleted', outcome: 'allowed', metadata: { deletedUserId: req.params.id } });
    return res.json({ deleted: true, userId: req.params.id });
  }));
  return router;
}
export const adminDeleteUsersRouter = createAdminDeleteUsersRouter();
