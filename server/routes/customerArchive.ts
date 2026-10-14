import express from 'express';
import { zipSync } from 'fflate';
import { asyncHandler, sendOpaqueError } from '../middleware.js';
import { requireAdmin } from './admin.js';
import { isUuid, requireExactObject, writeSecurityEvent } from '../security.js';

const MAX_ARCHIVE_CUSTOMERS = 25;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const uuidList = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_ARCHIVE_CUSTOMERS && ids.every(isUuid) && new Set(ids).size === ids.length;
const failure = (message: string): never => { throw new Error(message); };

async function listCustomers(db: any) {
  const customers: any[] = [];
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) failure('Unable to list customer accounts.');
    const users = data?.users ?? [];
    if (!users.length) break;
    const { data: profiles, error: profileError } = await db.from('profiles').select('id,role,preferred_name,updated_at').in('id', users.map((user: any) => user.id));
    if (profileError) failure('Unable to load customer profiles.');
    const profilesById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    for (const user of users) {
      const profile: any = profilesById.get(user.id);
      const role = profile?.role ?? 'user';
      if (!['user', 'beta_tester'].includes(role)) continue;
      customers.push({ id: user.id, name: profile?.preferred_name?.trim() || user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer', email: user.email ?? '', role, signupAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null, profileUpdatedAt: profile?.updated_at ?? null });
    }
    if (users.length < 1000) break;
  }
  return customers;
}

async function fetchRows(db: any, table: string, column: string, value: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select('*').eq(column, value).range(offset, offset + 999);
    if (error) failure(`Could not include ${table} in the archive.`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function fetchFilteredRows(db: any, table: string, filter: (query: any) => any) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await filter(db.from(table).select('*')).range(offset, offset + 999);
    if (error) failure(`Could not include ${table} in the archive.`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function archiveCustomer(db: any, customerId: string) {
  const [{ data: authData, error: authError }, profile] = await Promise.all([
    db.auth.admin.getUserById(customerId),
    db.from('profiles').select('*').eq('id', customerId).maybeSingle(),
  ]);
  if (authError || !authData?.user) failure('A selected customer account no longer exists. Refresh the page and try again.');
  if (profile.error) failure('Could not include the customer profile in the archive.');
  const user = authData.user;
  const data: Record<string, unknown> = {
    identity: { id: user.id, email: user.email ?? null, phone: user.phone ?? null, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null, email_confirmed_at: user.email_confirmed_at ?? null, user_metadata: user.user_metadata ?? {}, identities: (user.identities ?? []).map((identity: any) => ({ provider: identity.provider, identity_id: identity.identity_id, identity_data: identity.identity_data })) },
    profiles: profile.data ? [profile.data] : [],
  };
  const tables: Array<[string, string]> = [
    ['memory_entries', 'user_id'], ['journal_entries', 'user_id'], ['daily_mood_logs', 'user_id'], ['chat_messages', 'user_id'], ['subscriptions', 'user_id'],
    ['crm_notes', 'user_id'], ['crm_tasks', 'user_id'], ['crm_payments', 'user_id'], ['crm_entitlements', 'user_id'], ['crm_activities', 'user_id'], ['crm_communications', 'user_id'],
    ['referral_codes', 'user_id'], ['referral_credits', 'user_id'], ['audit_logs', 'user_id'], ['premium_continuity', 'user_id'], ['privacy_requests', 'user_id'],
    ['hosted_ai_usage_windows', 'user_id'], ['founder_subscriber_slots', 'user_id'], ['feedback_suggestions', 'user_id'], ['peer_knowledge_posts', 'user_id'],
    ['ai_safety_events', 'user_id'],
  ];
  const results = await Promise.all(tables.map(([table, column]) => fetchRows(db, table, column, customerId)));
  tables.forEach(([table], index) => { data[table] = results[index]; });
  data.referrals = await fetchFilteredRows(db, 'referrals', (query: any) => query.or(`referrer_user_id.eq.${customerId},prospect_user_id.eq.${customerId}`));
  data.security_events = await fetchRows(db, 'security_events', 'subject_id', customerId);
  const messages = data.chat_messages as any[];
  data.sentiment_feedback = messages.length ? await fetchFilteredRows(db, 'sentiment_feedback', (query: any) => query.in('message_id', messages.map(row => row.id))) : [];
  const requests = await fetchRows(db, 'contact_requests', 'user_id', customerId);
  const guestRequests = user.email ? await fetchFilteredRows(db, 'contact_requests', (query: any) => query.eq('email', user.email).is('user_id', null)) : [];
  const allRequests = [...new Map([...requests, ...guestRequests].map((row: any) => [row.id, row])).values()];
  data.contact_requests = allRequests;
  const requestIds = allRequests.map((row: any) => row.id);
  const supportMessages = requestIds.length ? await fetchFilteredRows(db, 'support_messages', (query: any) => query.in('request_id', requestIds)) : [];
  const supportEvents = requestIds.length ? await fetchFilteredRows(db, 'support_events', (query: any) => query.in('request_id', requestIds)) : [];
  const attachments = requestIds.length ? await fetchFilteredRows(db, 'support_attachments', (query: any) => query.in('request_id', requestIds)) : [];
  data.support_messages = supportMessages;
  data.support_events = supportEvents;
  data.support_attachments = attachments.map(({ object_path: _objectPath, ...row }: any) => row);
  const privacyRequests = data.privacy_requests as any[];
  data.processor_deletion_tasks = privacyRequests.length ? await fetchFilteredRows(db, 'processor_deletion_tasks', (query: any) => query.in('privacy_request_id', privacyRequests.map(row => row.id))) : [];
  const suggestions = data.feedback_suggestions as any[];
  data.feedback_events = suggestions.length ? await fetchFilteredRows(db, 'feedback_events', (query: any) => query.in('suggestion_id', suggestions.map(row => row.id))) : [];
  const messageIds = new Set(supportMessages.map((row: any) => row.id));
  data.support_notifications = messageIds.size ? await fetchFilteredRows(db, 'support_notifications', (query: any) => query.in('message_id', [...messageIds])) : [];
  const zipFiles: Record<string, Uint8Array> = {};
  const prefix = `customer-${customerId}/`;
  zipFiles[`${prefix}data.json`] = new TextEncoder().encode(JSON.stringify(data, null, 2));
  let attachmentBytes = 0;
  for (const attachment of attachments as any[]) {
    if (attachment.status !== 'ready') continue;
    const download = await db.storage.from('q-support-private').download(attachment.object_path);
    if (download.error || !download.data) failure('A customer support attachment could not be added. The archive was not completed.');
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    attachmentBytes += bytes.byteLength;
    if (attachmentBytes > MAX_ARCHIVE_BYTES) failure('This archive is too large to prepare as one download. Select fewer customers and try again.');
    const safeName = String(attachment.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    zipFiles[`${prefix}attachments/${attachment.id}-${safeName}`] = bytes;
  }
  return zipFiles;
}

const activitySources: Array<[string, string, string]> = [
  ['profiles', 'id', 'updated_at'], ['memory_entries', 'user_id', 'updated_at'], ['journal_entries', 'user_id', 'updated_at'], ['daily_mood_logs', 'user_id', 'created_at'],
  ['chat_messages', 'user_id', 'created_at'], ['subscriptions', 'user_id', 'updated_at'], ['crm_notes', 'user_id', 'updated_at'], ['crm_tasks', 'user_id', 'updated_at'],
  ['crm_payments', 'user_id', 'occurred_at'], ['crm_entitlements', 'user_id', 'updated_at'], ['crm_activities', 'user_id', 'created_at'], ['crm_communications', 'user_id', 'created_at'],
  ['referral_credits', 'user_id', 'created_at'], ['premium_continuity', 'user_id', 'updated_at'], ['feedback_suggestions', 'user_id', 'updated_at'],
  ['peer_knowledge_posts', 'user_id', 'updated_at'], ['contact_requests', 'user_id', 'updated_at'], ['support_messages', 'author_id', 'created_at'],
  ['support_events', 'actor_id', 'created_at'], ['ai_safety_events', 'user_id', 'occurred_at'], ['privacy_requests', 'user_id', 'requested_at'], ['founder_subscriber_slots', 'user_id', 'reserved_at'],
];

async function lastActivityByUser(db: any, customers: any[]) {
  const map = new Map(customers.map(customer => [customer.id, Math.max(Date.parse(customer.signupAt) || 0, Date.parse(customer.lastSignInAt ?? '') || 0)]));
  for (const [table, ownerColumn, timestampColumn] of activitySources) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from(table).select(`${ownerColumn},${timestampColumn}`).in(ownerColumn, customers.map(customer => customer.id)).order(timestampColumn, { ascending: false }).range(offset, offset + 999);
      if (error) failure('Could not calculate the account activity period.');
      for (const row of data ?? []) {
        const timestamp = Date.parse(row[timestampColumn] ?? '') || 0;
        const previous = map.get(row[ownerColumn]);
        if (previous !== undefined && timestamp > previous) map.set(row[ownerColumn], timestamp);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  return map;
}

export function createCustomerArchiveRouter(authoriseAdmin: typeof requireAdmin = requireAdmin) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); next(); });
  router.get('/customers', asyncHandler(async (req, res) => {
    const admin = await authoriseAdmin(req, res); if (!admin) return;
    const customers = await listCustomers(admin.serviceSupabase);
    const search = String(req.query.search ?? '').trim().toLowerCase();
    return res.json({ customers: search ? customers.filter(customer => `${customer.name} ${customer.email}`.toLowerCase().includes(search)) : customers });
  }));
  router.post('/candidates', asyncHandler(async (req, res) => {
    const admin = await authoriseAdmin(req, res); if (!admin) return;
    const { criterion, days } = req.body ?? {};
    if (!requireExactObject(req.body, ['criterion', 'days']) || !['signup', 'sign_in', 'activity'].includes(criterion) || !Number.isInteger(days) || days < 1 || days > 3650) return res.status(400).json({ error: 'Choose a supported time period from 1 to 3,650 days.' });
    const customers = await listCustomers(admin.serviceSupabase);
    const cutoff = Date.now() - days * 86400000;
    let matches: any[];
    if (criterion === 'signup') matches = customers.filter(customer => Date.parse(customer.signupAt) < cutoff);
    else if (criterion === 'sign_in') matches = customers.filter(customer => customer.lastSignInAt ? Date.parse(customer.lastSignInAt) < cutoff : Date.parse(customer.signupAt) < cutoff);
    else {
      const activity = await lastActivityByUser(admin.serviceSupabase, customers);
      matches = customers.filter(customer => (activity.get(customer.id) ?? 0) < cutoff);
    }
    return res.json({ customers: matches, cutoff: new Date(cutoff).toISOString(), criterion, days });
  }));
  router.post('/export', asyncHandler(async (req, res) => {
    const admin = await authoriseAdmin(req, res); if (!admin) return;
    const ids = req.body?.customerIds;
    if (!requireExactObject(req.body, ['customerIds']) || !uuidList(ids)) return res.status(400).json({ error: `Select between 1 and ${MAX_ARCHIVE_CUSTOMERS} unique customers.` });
    const customers = await listCustomers(admin.serviceSupabase);
    if (ids.some(id => !customers.some(customer => customer.id === id))) return res.status(403).json({ error: 'Only customer accounts can be archived here. Refresh the list and try again.' });
    try {
      const files: Record<string, Uint8Array> = { 'manifest.json': new TextEncoder().encode(JSON.stringify({ format: 'Q customer archive', version: 1, generatedAt: new Date().toISOString(), customerCount: ids.length, contents: 'Account identity and profile, private memory and journal, mood and chat records, subscriptions and Q billing ledger, CRM notes and activity, support requests/messages/events/attachments, referrals, feedback, peer contributions, privacy requests, security events and available usage records.', exclusions: 'Passwords and credentials, support access token hashes, browser-local data, external provider accounts and records, and files not attached to these accounts.' }, null, 2)) };
      for (const id of ids) Object.assign(files, await archiveCustomer(admin.serviceSupabase, id));
      const zipped = zipSync(files, { level: 6 });
      if (zipped.byteLength > MAX_ARCHIVE_BYTES) return res.status(413).json({ error: 'This archive is too large to download at once. Select fewer customers and try again.' });
      await writeSecurityEvent(admin.serviceSupabase, req, { actorId: admin.identity.user.id, action: 'admin.customer.archive_export', outcome: 'allowed', metadata: { customerCount: ids.length, customerIds: ids } });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="q-customer-archive-${new Date().toISOString().slice(0, 10)}.zip"`);
      res.setHeader('Content-Length', String(zipped.byteLength));
      return res.status(200).send(Buffer.from(zipped));
    } catch (error) {
      await writeSecurityEvent(admin.serviceSupabase, req, { actorId: admin.identity.user.id, action: 'admin.customer.archive_export', outcome: 'failed', metadata: { customerCount: ids.length } });
      return sendOpaqueError(req, res, 503, error instanceof Error ? error.message : 'Customer archive could not be prepared.', 'Customer Archive Export', error);
    }
  }));
  return router;
}

export const customerArchiveRouter = createCustomerArchiveRouter();
