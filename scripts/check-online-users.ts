import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { createOnlinePresenceRouter } from '../server/routes/onlinePresence';
import { presenceSigningKey, signPresenceTicket, verifyPresenceTicket, presenceDisplayName, PRESENCE_TICKET_LIFETIME_MS } from '../server/onlinePresence';
import { presenceTickets, readableTopics } from '../src/shared/onlinePresence';

const ids = { customer: '00000000-0000-4000-8000-000000000001', staff: '00000000-0000-4000-8000-000000000002', admin: '00000000-0000-4000-8000-000000000003', beta: '00000000-0000-4000-8000-000000000004' };
const key = presenceSigningKey('fixture-service-secret'); const now = 1_800_000_000_000;
const customerTicket = signPresenceTicket(ids.customer, 'customer', key, now);
const staffTicket = signPresenceTicket(ids.staff, 'staff', key, now);
const adminTicket = signPresenceTicket(ids.admin, 'admin', key, now);
assert.equal(verifyPresenceTicket(customerTicket, key, now)?.user_id, ids.customer);
assert.equal(verifyPresenceTicket(customerTicket, key, now + PRESENCE_TICKET_LIFETIME_MS), null);
assert.equal(verifyPresenceTicket(customerTicket, key, now - 1), null);
assert.equal(verifyPresenceTicket(customerTicket, presenceSigningKey('other-secret'), now), null);
const [, signature] = customerTicket.split('.');
const fake = Buffer.from(JSON.stringify({ user_id: ids.admin, role: 'admin', issued_at: now })).toString('base64url');
assert.equal(verifyPresenceTicket(`${fake}.${signature}`, key, now), null);
assert.equal(verifyPresenceTicket('invalid', key, now), null);
assert.deepEqual(readableTopics('staff'), ['online-users']); assert.deepEqual(readableTopics('customer'), []);
assert.equal(presenceDisplayName({ role: 'user', preferred_name: '' }), 'Signed-in customer');
assert.deepEqual(presenceTickets([{ a: [{ ticket: customerTicket }, { ticket: customerTicket }, { display_name: 'fake' }] }]), [customerTicket]);

const profiles = [
  { id: ids.customer, role: 'user', preferred_name: 'Robin' },
  { id: ids.staff, role: 'staff', preferred_name: 'Sam' },
  { id: ids.admin, role: 'partner_admin', preferred_name: 'Alex' },
  { id: ids.beta, role: 'beta_tester', preferred_name: null },
];
let databaseFailure = false;
const db = { from() {
  const filters: { key: string; values: unknown[] }[] = [];
  const result = () => ({ data: databaseFailure ? null : profiles.filter(profile => filters.every(filter => filter.values.includes(profile[filter.key]))), error: databaseFailure ? { message: 'private fixture details' } : null });
  const query: any = {
    select: () => query,
    eq: (name: string, value: unknown) => { filters.push({ key: name, values: [value] }); return query; },
    in: (name: string, values: unknown[]) => { filters.push({ key: name, values }); return query; },
    maybeSingle: async () => { const data = result(); return { ...data, data: data.data?.[0] ?? null }; },
    then: (resolve: any) => Promise.resolve(result()).then(resolve),
  }; return query;
} };
const app = express(); app.use(express.json());
app.use('/api/presence', createOnlinePresenceRouter({
  authenticate: (async req => {
    const id = ids[String(req.headers.authorization).replace('Bearer ', '')];
    return id ? { user: { id, user_metadata: { role: 'partner_admin', full_name: 'Forged name' } } } : null;
  }) as any,
  serviceDb: (() => db) as any, signingKey: () => key, now: () => now,
}));
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address(); assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const request = (path: string, role = '', body?: unknown) => fetch(`${origin}/api/presence/${path}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { ...(role ? { Authorization: `Bearer ${role}` } : {}), 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
try {
  assert.equal((await request('me')).status, 401);
  const customerAccess = await (await request('me', 'customer')).json();
  assert.equal(customerAccess.role, 'customer'); assert.deepEqual(customerAccess.readTopics, []);
  assert(!JSON.stringify(customerAccess).includes('Forged name'));
  assert.equal((await request('resolve', 'customer', { tickets: [] })).status, 403);
  const allTickets = [customerTicket, staffTicket, adminTicket, customerTicket];
  const staffResponse = await request('resolve', 'staff', { tickets: allTickets });
  assert.equal(staffResponse.headers.get('cache-control'), 'no-store');
  const staffList = await staffResponse.json(); assert.deepEqual(staffList.users.map((user: any) => user.user_id), [ids.customer]);
  assert.equal(staffList.users[0].display_name, 'Robin');
  assert.equal((await (await request('resolve', 'admin', { tickets: allTickets })).json()).users.length, 3);
  assert.equal((await (await request('resolve', 'admin', { tickets: [`${fake}.${signature}`] })).json()).users.length, 0);
  profiles[0].role = 'staff';
  assert.equal((await (await request('resolve', 'staff', { tickets: [customerTicket] })).json()).users.length, 0);
  profiles[0].role = 'user';
  profiles[2].role = 'staff';
  assert.equal((await (await request('resolve', 'admin', { tickets: allTickets })).json()).users.length, 1);
  profiles[2].role = 'partner_admin';
  assert.equal((await request('resolve', 'staff', { tickets: [], role: 'admin' })).status, 400);
  assert.equal((await request('resolve', 'staff', { tickets: Array(76).fill(customerTicket) })).status, 400);
  assert.equal((await request('resolve', 'staff', { tickets: [7] })).status, 400);
  databaseFailure = true;
  const failed = await request('me', 'staff'); assert.equal(failed.status, 503);
  assert(!(await failed.text()).includes('private fixture details'));
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
console.log('PASS signed identity, expiry, deduplication, API role isolation, demotion and failure handling');

const pg = new PGlite();
try {
  await pg.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema realtime;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
    grant usage on schema auth, realtime to anon, authenticated, service_role;
    create table public.profiles(id uuid primary key, role text not null default 'user', preferred_name text, org_id text, staff_permissions text[] not null default '{}');
    alter table public.profiles enable row level security;
    grant select, insert, update on public.profiles to authenticated;
    grant all on public.profiles to service_role;
    create policy own_profile on public.profiles to authenticated using (id = auth.uid()) with check (id = auth.uid());
    create table realtime.messages(id bigint generated always as identity, extension text);
    alter table realtime.messages enable row level security;
    grant select, insert on realtime.messages to authenticated, anon;
    grant usage on sequence realtime.messages_id_seq to authenticated, anon;
    insert into realtime.messages(extension) values ('presence');
    insert into public.profiles(id,role) values ('${ids.customer}','user'),('${ids.staff}','staff'),('${ids.admin}','partner_admin'),('${ids.beta}','beta_tester');
  `);
  for (const migration of ['20261001094314_online_users_presence.sql', '20261001094510_protect_profile_access_fields.sql']) {
    await pg.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const setSession = async (id: string, topic: string) => {
    await pg.exec('reset role');
    await pg.query("select set_config('request.jwt.sub', $1, false), set_config('realtime.topic', $2, false)", [id, topic]);
    await pg.exec('set role authenticated');
  };
  for (const [viewer, topic, read, write] of [
    ['customer','online-users',false,true], ['customer','online-staff',false,false], ['customer','online-admins',false,false],
    ['beta','online-users',false,true], ['staff','online-users',true,false], ['staff','online-staff',false,true], ['staff','online-admins',false,false],
    ['admin','online-users',true,false], ['admin','online-staff',true,false], ['admin','online-admins',true,true],
  ] as const) {
    await setSession(ids[viewer], topic);
    assert.equal((await pg.query('select * from realtime.messages')).rows.length > 0, read, `${viewer} reads ${topic}`);
    const publish = () => pg.query("insert into realtime.messages(extension) values ('presence')");
    if (write) await publish(); else await assert.rejects(publish, /row-level security/);
  }
  // An unrelated permissive policy must not bypass the reserved-topic restrictions.
  await pg.exec("reset role; create policy broad_read on realtime.messages for select using (true); create policy broad_write on realtime.messages for insert with check (true);");
  await setSession(ids.staff, 'online-admins');
  assert.equal((await pg.query('select * from realtime.messages')).rows.length, 0);
  await assert.rejects(() => pg.query("insert into realtime.messages(extension) values ('presence')"), /row-level security/);
  await setSession(ids.customer, 'online-users');
  assert.equal((await pg.query('select * from realtime.messages')).rows.length, 0);
  await assert.rejects(() => pg.query("insert into realtime.messages(extension) values ('broadcast')"), /row-level security/);
  await pg.exec('reset role');
  await pg.query("select set_config('request.jwt.sub', '', false), set_config('realtime.topic', 'online-users', false)");
  await pg.exec('set role anon');
  await assert.rejects(() => pg.query('select * from realtime.messages'), /permission denied/);
  await setSession(ids.customer, 'online-users');
  await pg.query("update public.profiles set preferred_name='New name' where id=$1", [ids.customer]);
  for (const assignment of ["role='partner_admin'", "staff_permissions=array['security.admin']", "org_id='other-org'"]) {
    await assert.rejects(() => pg.query(`update public.profiles set ${assignment} where id=$1`, [ids.customer]), /access fields/);
  }
  await pg.exec('reset role; set role service_role');
  await pg.query("update public.profiles set role='staff' where id=$1", [ids.customer]);
  await pg.exec('reset role');
  await pg.query('delete from public.profiles where id=$1', [ids.customer]);
  await setSession(ids.customer, 'online-users');
  await assert.rejects(() => pg.query("insert into public.profiles(id,role) values ($1,'partner_admin')", [ids.customer]), /access fields/);
  await pg.query('insert into public.profiles(id) values ($1)', [ids.customer]);
  const advisors = await pg.query<{ count: number }>("select count(*)::int as count from pg_class where oid in ('public.profiles'::regclass,'realtime.messages'::regclass) and relrowsecurity");
  assert.equal(advisors.rows[0].count, 2);
} finally { await pg.close(); }
console.log('PASS PostgreSQL channel RLS, broad-policy guards and protected profile access fields');
