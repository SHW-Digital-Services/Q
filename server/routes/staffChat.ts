import express from 'express';
import { requireStaff } from './admin.js';
import { asyncHandler } from '../middleware.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields = 'id,user_id,recipient_id,display_name,role,body,created_at';
// Scope every history/update read, including for administrators, to its participants.
export const chatVisibility = (userId: string) => `recipient_id.is.null,user_id.eq.${userId},recipient_id.eq.${userId}`;

export function createStaffChatRouter(authorise = requireStaff) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); next(); });
  router.post('/sync', asyncHandler(async (req, res) => {
    const staff = await authorise(req, res); if (!staff) return;
    const session = req.body?.session;
    const cursor = req.body?.cursor;
    if (typeof session !== 'string' || !uuid.test(session) || (cursor !== undefined && !/^\d{1,18}$/.test(String(cursor)))) {
      res.status(400).json({ error: 'Invalid chat session.' }); return;
    }
    const db = staff.serviceSupabase;
    const heartbeat = await db.from('staff_chat_presence').upsert({ session_id: session, user_id: staff.identity.user.id, last_seen: new Date().toISOString() }, { onConflict: 'user_id,session_id' });
    if (heartbeat.error) { res.status(503).json({ error: 'Team chat is unavailable. Check that the staff chat migration has been applied.' }); return; }
    let query = db.from('staff_chat_messages').select(fields).or(chatVisibility(staff.identity.user.id));
    query = cursor === undefined ? query.order('id', { ascending: false }).limit(100) : query.gt('id', String(cursor)).order('id', { ascending: true }).limit(100);
    const [messages, presence, team] = await Promise.all([
      query,
      db.from('staff_chat_presence').select('user_id,profiles!inner(id,preferred_name,role)').gte('last_seen', new Date(Date.now() - 90000).toISOString()).in('profiles.role', ['staff', 'partner_admin']),
      db.from('profiles').select('id,preferred_name,role').in('role', ['staff', 'partner_admin']).order('preferred_name'),
    ]);
    if (messages.error || presence.error || team.error) { res.status(503).json({ error: 'Unable to load team chat.' }); return; }
    const users = new Map<string, { id: string; name: string; role: string }>();
    for (const row of presence.data || []) {
      const profile = row.profiles as any;
      users.set(row.user_id, { id: row.user_id, name: profile.preferred_name || 'Team member', role: profile.role });
    }
    res.json({ messages: cursor === undefined ? (messages.data || []).reverse() : messages.data || [], users: [...users.values()], team: (team.data || []).map(profile => ({ id: profile.id, name: profile.preferred_name || 'Team member', role: profile.role })), userId: staff.identity.user.id });
  }));
  router.post('/history', asyncHandler(async (req, res) => {
    const staff = await authorise(req, res); if (!staff) return;
    const recipient = req.body?.recipient ?? null;
    if (recipient !== null && (typeof recipient !== 'string' || !uuid.test(recipient) || recipient === staff.identity.user.id)) { res.status(400).json({ error: 'Choose another team member.' }); return; }
    let query = staff.serviceSupabase.from('staff_chat_messages').select(fields);
    query = recipient === null ? query.is('recipient_id', null) : query.or(`and(user_id.eq.${staff.identity.user.id},recipient_id.eq.${recipient}),and(user_id.eq.${recipient},recipient_id.eq.${staff.identity.user.id})`);
    const result = await query.order('id', { ascending: false }).limit(100);
    if (result.error) { res.status(503).json({ error: 'Unable to load this conversation.' }); return; }
    res.json({ messages: (result.data || []).reverse() });
  }));
  router.post('/messages', asyncHandler(async (req, res) => {
    const staff = await authorise(req, res); if (!staff) return;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const id = req.body?.id;
    const recipient = req.body?.recipient ?? null;
    if (!body || body.length > 2000 || typeof id !== 'string' || !uuid.test(id)) { res.status(400).json({ error: 'Enter a message of up to 2,000 characters.' }); return; }
    const db = staff.serviceSupabase;
    if (recipient !== null) {
      if (typeof recipient !== 'string' || !uuid.test(recipient) || recipient === staff.identity.user.id) { res.status(400).json({ error: 'Choose another team member.' }); return; }
      const target = await db.from('profiles').select('role').eq('id', recipient).maybeSingle();
      if (target.error) { res.status(503).json({ error: 'Unable to check the recipient.' }); return; }
      if (!['staff', 'partner_admin'].includes(target.data?.role || '')) { res.status(400).json({ error: 'Private messages can only be sent to Staff and Admins.' }); return; }
    }
    const profile = await db.from('profiles').select('preferred_name').eq('id', staff.identity.user.id).single();
    if (profile.error) { res.status(503).json({ error: 'Unable to check your chat profile.' }); return; }
    // A client request ID makes retrying a failed response safe without duplicating messages.
    const result = await db.from('staff_chat_messages').insert({ request_id: id, user_id: staff.identity.user.id, recipient_id: recipient, display_name: profile.data.preferred_name || 'Team member', role: staff.role, body });
    if (result.error && result.error.code !== '23505') { res.status(503).json({ error: 'Message could not be sent. Your draft has been kept.' }); return; }
    res.status(201).json({ success: true });
  }));
  router.post('/leave', asyncHandler(async (req, res) => {
    const staff = await authorise(req, res); if (!staff) return;
    await staff.serviceSupabase.from('staff_chat_presence').delete().eq('user_id', staff.identity.user.id).eq('session_id', String(req.body?.session || ''));
    res.json({ success: true });
  }));
  return router;
}
export const staffChatRouter = createStaffChatRouter();

