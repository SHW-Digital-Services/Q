import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { hashWebhookToken, newWebhookToken, newIntegrationAddress, normaliseBrevoEvents } from '../server/brevoWebhooks';
import { createBrevoWebhookRouters } from '../server/routes/brevoWebhooks';
import { brevoEventInfo, brevoGroupTypes, brevoReadableDetails } from '../src/shared/brevoEventPresentation';
import { eventMetricsData } from '../src/components/BrevoEventMetrics';

const db = new PGlite();
const endpoint = '00000000-0000-4000-8000-000000000001';
const secret = newWebhookToken();
const callRpc = async (hash: string, events: unknown) => (await db.query<{ result: any }>('select public.receive_brevo_webhook($1,$2,$3::jsonb) as result', [endpoint, hash, JSON.stringify(events)])).rows[0].result;
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); grant usage on schema public to anon, authenticated, service_role;');
  await db.exec(await readFile('supabase/migrations/20260929214155_incoming_webhooks.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261001095913_brevo_event_metrics.sql', 'utf8'));
  await db.query('insert into auth.users(id) values ($1)', [endpoint]);
  assert.equal(brevoEventInfo('hardBounce').title, 'Permanent delivery failure');
  assert.equal(brevoEventInfo('soft_bounce').group, 'problems');
  assert.equal(brevoEventInfo('contactUpdated').group, 'contacts');
  assert(brevoGroupTypes('problems').includes('hardBounce'));
  assert.equal(brevoEventInfo('unexpected_event').group, 'other');
  assert.deepEqual(brevoReadableDetails({ subject: 'Hello', reason: { private: 'not summarised' } }), [{ label: 'Subject', value: 'Hello' }]);
  assert.match(secret.token, /^q_brevo_[A-Za-z0-9_-]{43}$/); assert.equal(hashWebhookToken(secret.token), secret.token_hash);
  assert.match(newIntegrationAddress(), /^[a-f0-9]{24}@q-ai\.online$/);
  assert.equal(new Set(Array.from({ length: 100 }, newIntegrationAddress)).size, 100);
  const first = { event: 'delivered', email: 'recipient@example.test', id: 123, ts_event: 1 };
  const a = normaliseBrevoEvents(first)[0];
  assert.equal(normaliseBrevoEvents({ ts_event: 1, id: 123, email: 'recipient@example.test', event: 'delivered' })[0].dedupe_key, a.dedupe_key);
  const b = normaliseBrevoEvents({ ...first, event: 'opened', ts_event: 2 })[0]; assert.notEqual(a.dedupe_key, b.dedupe_key);
  const redacted = normaliseBrevoEvents({ ...first, secret: 'do-not-store', nested: { authorization: 'do-not-store', token: 'do-not-store', safe: 'keep' } })[0];
  assert(!JSON.stringify(redacted.payload).includes('do-not-store')); assert(JSON.stringify(redacted.payload).includes('keep'));
  for (const invalid of [null, [], [{ event: 'delivered' }, 'bad'], { event: '' }, { event: 'opened', email: 22 }, Array.from({ length: 101 }, () => first), { event: 'opened', data: 'x'.repeat(33000) }]) assert.throws(() => normaliseBrevoEvents(invalid));
  let deep: any = {}; for (let i = 0; i < 22; i++) deep = { deeper: deep }; assert.throws(() => normaliseBrevoEvents({ event: 'opened', deep }));
  await db.query('insert into public.brevo_webhook_endpoints(id,name,webhook_type,integration_address,token_hash,token_prefix) values($1,$2,$3,$4,$5,$6)', [endpoint, 'Brevo fixture', 'transactional', newIntegrationAddress(), secret.token_hash, secret.token_prefix]);
  await db.exec('set role service_role');
  assert.deepEqual(await callRpc(secret.token_hash, [a, b]), { authorised: true, received: 2, duplicates: 0 });
  assert.deepEqual(await callRpc(secret.token_hash, [a, b]), { authorised: true, received: 0, duplicates: 2 });
  assert.deepEqual(await callRpc('wrong', [a]), { authorised: false });
  const c = normaliseBrevoEvents({ ...first, event: 'clicked', ts_event: 3 })[0];
  await assert.rejects(callRpc(secret.token_hash, [c, { ...a, dedupe_key: 'x'.repeat(64), event_type: '' }]));
  assert.equal((await db.query('select id from public.brevo_webhook_events')).rows.length, 2, 'Invalid batch must not partially insert');
  await assert.rejects(db.query('select public.receive_brevo_webhook($1,$2,null)', [endpoint, secret.token_hash]));
  await db.query('update public.brevo_webhook_endpoints set active=false where id=$1', [endpoint]); assert.deepEqual(await callRpc(secret.token_hash, [c]), { authorised: false });
  const rotated = newWebhookToken();
  await db.query('update public.brevo_webhook_endpoints set active=true,token_hash=$2 where id=$1', [endpoint, rotated.token_hash]);
  assert.deepEqual(await callRpc(secret.token_hash, [c]), { authorised: false }); assert.equal((await callRpc(rotated.token_hash, [c])).received, 1);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query('select * from public.brevo_webhook_endpoints'), /permission denied/);
    await assert.rejects(db.query('select * from public.brevo_webhook_events'), /permission denied/);
    await assert.rejects(callRpc(rotated.token_hash, [a]), /permission denied/);
    await assert.rejects(db.query('select public.brevo_event_metrics(30)'), /permission denied/);
  }
  await db.exec('reset role; set role service_role');
  const adapter = {
    from(table: string) {
      let columns = '*'; let countRequested = false; let head = false; let offset = 0; let limit: number | null = null; const values: unknown[] = []; const filters: string[] = []; const assignments: string[] = [];
      const query: any = { select: (value: string, options?: any) => { columns = value; countRequested = options?.count === 'exact'; head = Boolean(options?.head); return query; }, eq: (field: string, value: unknown) => { values.push(value); filters.push(`${field}=$${values.length}`); return query; }, order: () => query, range: (start: number, end: number) => { offset = start; limit = end - start + 1; return query; }, gte: (field: string, value: unknown) => { values.push(value); filters.push(`${field}>=$${values.length}`); return query; }, lt: (field: string, value: unknown) => { values.push(value); filters.push(`${field}<$${values.length}`); return query; },
        in: (field: string, items: unknown[]) => { values.push(items); filters.push(`${field}=any($${values.length}::${field === 'id' ? 'uuid' : 'text'}[])`); return query; },
        update: (patch: Record<string, unknown>) => { for (const [field, value] of Object.entries(patch)) { values.push(value); assignments.push(`${field}=$${values.length}`); } return query; },
        maybeSingle: async () => { const result = await query; return { ...result, data: result.data[0] || null }; },
        then: (resolve: any) => (async () => { const where = filters.length ? ` where ${filters.join(' and ')}` : ''; if (assignments.length) return { data: (await db.query(`update public.${table} set ${assignments.join(',')}${where} returning ${columns}`, values)).rows, error: null }; const counted = countRequested ? (await db.query<{ total: number }>(`select count(*)::int as total from public.${table}${where}`, values)).rows[0].total : null; const rows = head ? null : (await db.query(`select ${columns} from public.${table}${where}${limit !== null ? ` limit ${limit} offset ${offset}` : ''}`, values)).rows; return { data: rows, count: counted, error: null }; })().then(resolve)
      }; return query;
    },
    rpc: async (name: string, params: any) => ({ data: name === 'brevo_event_metrics' ? (await db.query<{ result: any }>('select public.brevo_event_metrics($1) as result', [params.p_days])).rows[0].result : await callRpc(params.p_token_hash, params.p_events), error: null })
  };
  const routers = createBrevoWebhookRouters({ getDb: () => adapter, baseUrl: () => 'https://q.example.test', authoriseAdmin: (async (req: any, res: any) => {
    if (req.headers.authorization !== 'Bearer fixture-admin') { res.status(req.headers.authorization ? 403 : 401).json({ error: 'Admin required.' }); return null; }
    return { identity: { user: { id: endpoint } }, serviceSupabase: adapter };
  }) as any });
  const app = express(); app.use(express.json({ limit: '256kb' })); app.use('/receive', routers.receiver); app.use('/admin', routers.admin);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const post = (token: string, body: unknown = first) => fetch(`${origin}/receive/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post(secret.token)).status, 401);
    assert.equal((await post(rotated.token, { event: '' })).status, 400);
    const receipt = await post(rotated.token, first); assert.equal(receipt.status, 200); assert.equal((await receipt.json()).duplicates, 1);
    assert.equal((await fetch(`${origin}/admin/endpoints`)).status, 401);
    assert.equal((await fetch(`${origin}/admin/endpoints`, { headers: { Authorization: 'Bearer fixture-staff' } })).status, 403);
    for (const path of ['/dashboard', '/events', '/metrics']) {
      assert.equal((await fetch(`${origin}/admin${path}`)).status, 401);
      assert.equal((await fetch(`${origin}/admin${path}`, { headers: { Authorization: 'Bearer fixture-staff' } })).status, 403);
    }
    const adminGet = async (path: string) => { const response = await fetch(`${origin}/admin${path}`, { headers: { Authorization: 'Bearer fixture-admin' } }); assert.equal(response.status, 200); return response.json(); };
    const summary = await adminGet('/dashboard'); assert.equal(summary.total, 3); assert.equal(summary.awaitingReview, 3); assert.equal(summary.reviewed, 0); assert.equal(summary.today, 3);
    const all = await adminGet('/events'); assert.equal(all.total, 3); assert.equal(all.events.length, 3); assert.equal(all.hasMore, false); assert(!JSON.stringify(all).includes('payload'));
    assert.equal((await adminGet('/events?eventType=opened')).total, 1);
    assert.equal((await adminGet('/events?eventGroup=engagement')).total, 2);
    assert.equal((await adminGet('/events?eventGroup=problems')).total, 0);
    assert.equal((await adminGet('/events?email=missing%40example.test')).total, 0);
    assert.equal((await adminGet('/events?from=2000-01-01&to=2000-01-02')).total, 0);
    assert.equal((await adminGet('/events?offset=2')).events.length, 1);
    for (const filter of ['from=2026-02-30', 'from=2026-09-29&to=2026-09-28', 'eventType=' + 'x'.repeat(121)]) assert.equal((await fetch(`${origin}/admin/events?${filter}`, { headers: { Authorization: 'Bearer fixture-admin' } })).status, 400);
    await db.query("update public.brevo_webhook_events set status='reviewed' where event_type='opened'");
    assert.equal((await adminGet('/dashboard')).reviewed, 1);
    assert.equal((await adminGet('/events?status=reviewed')).total, 1);
    const reviewBatch = (auth: string, body: unknown) => fetch(`${origin}/admin/events/review`, { method: 'PATCH', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const batchIds = all.events.slice(0, 2).map((event: any) => event.id);
    assert.equal((await reviewBatch('fixture-staff', { ids: batchIds, status: 'reviewed' })).status, 403);
    for (const invalid of [{ ids: [], status: 'reviewed' }, { ids: ['bad'], status: 'reviewed' }, { ids: batchIds, status: 'deleted' }, { ids: Array(101).fill(batchIds[0]), status: 'reviewed' }, { ids: batchIds, status: 'reviewed', extra: true }]) assert.equal((await reviewBatch('fixture-admin', invalid)).status, 400);
    const batch = await reviewBatch('fixture-admin', { ids: [...batchIds, batchIds[0]], status: 'reviewed' });
    assert.equal(batch.status, 200); assert.equal((await batch.json()).updated, 2);
    const audit = await db.query<{ reviewed_by: string }>('select reviewed_by from public.brevo_webhook_events where id=any($1::uuid[])', [batchIds]);
    assert(audit.rows.every(row => row.reviewed_by === endpoint));
    await reviewBatch('fixture-admin', { ids: batchIds, status: 'received' });
    const reopened = await db.query<{ reviewed_at: unknown }>('select reviewed_at from public.brevo_webhook_events where id=any($1::uuid[])', [batchIds]);
    assert(reopened.rows.every(row => row.reviewed_at === null));
    const metrics = (await adminGet('/metrics?days=7')).metrics;
    assert.equal(metrics.total, 3); assert.equal(metrics.buckets.reduce((sum: number, bucket: any) => sum + bucket.count, 0), 3);
    assert.equal(eventMetricsData(metrics).daily.length, 7);
    assert.equal(eventMetricsData(metrics).engagement, 2);
    assert.equal((await fetch(`${origin}/admin/metrics?days=1000`, { headers: { Authorization: 'Bearer fixture-admin' } })).status, 400);
    await assert.rejects(db.query('select public.brevo_event_metrics(1000)'), /reporting period/);
    const lots = Array.from({ length: 120 }, (_, index) => normaliseBrevoEvents({ event: 'delivered', ts_event: index + 100 })[0]);
    await callRpc(rotated.token_hash, lots.slice(0, 60)); await callRpc(rotated.token_hash, lots.slice(60));
    assert.equal((await adminGet('/events')).events.length, 50);
    const completeMetrics = (await adminGet('/metrics?days=30')).metrics;
    assert.equal(completeMetrics.total, 123); assert.equal(eventMetricsData(completeMetrics).delivered, 121);
    await db.query("update public.brevo_webhook_events set received_at=(now() at time zone 'UTC')::date::timestamp at time zone 'UTC' - interval '80 days' where id=$1", [batchIds[0]]);
    assert.equal((await adminGet('/metrics?days=7')).metrics.total, 122);
    assert.equal((await adminGet('/metrics?days=90')).metrics.total, 123);
    const list = await fetch(`${origin}/admin/endpoints`, { headers: { Authorization: 'Bearer fixture-admin' } });
    assert.equal(list.status, 200); const body = await list.text(); assert(!body.includes('token_hash')); assert(!body.includes(rotated.token)); assert(body.includes('@q-ai.online'));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  console.log('PASS: Brevo payload validation/redaction, duplicate handling, atomic migration/RLS, rotation/disable and receiver/Admin access. No hosted database was changed.');
} finally { await db.close(); }
