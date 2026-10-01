import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { adminRouter } from '../server/routes/admin';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);`);
await db.exec(await readFile('supabase/migrations/20260828000003_contact_requests.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20261001103919_support_inbox_archive.sql', 'utf8'));
const id = '00000000-0000-4000-8000-000000000001';
await db.query(`insert into public.contact_requests(id,email,subject,message,status,response_text)
values ($1,'sample@example.com','Sample support','Sample support message','answered','Recorded reply')`, [id]);
let role = 'staff';
let permissions: string[] = ['support.read', 'support.write'];
const mock = express(); mock.use(express.json());
mock.get('/auth/v1/user', (_req,res) => res.json({ id, aud:'authenticated', role:'authenticated', email:'sample@example.com' }));
mock.get('/rest/v1/profiles', (_req,res) => res.json([{role,staff_permissions:permissions}]));
mock.post('/rest/v1/security_events', (_req,res) => res.status(201).json({}));
mock.get('/rest/v1/contact_requests', async (req,res) => {
  const archived = req.query.archived_at === 'not.is.null';
  assert.ok(['is.null','not.is.null'].includes(String(req.query.archived_at)));
  const result = await db.query(`select * from public.contact_requests where archived_at is ${archived?'not ':''}null order by created_at desc limit 200`);
  res.json(result.rows);
});
mock.patch('/rest/v1/contact_requests', async (req,res) => {
  assert.deepEqual(Object.keys(req.body).sort(), ['archived_at','updated_at']);
  const result = await db.query(`update public.contact_requests set archived_at=$1,updated_at=$2 where id=$3 returning *`, [req.body.archived_at,req.body.updated_at,String(req.query.id).replace(/^eq\./,'')]);
  res.json(result.rows[0] || null);
});
const mockServer = mock.listen(0, '127.0.0.1');
await new Promise<void>(resolve=>mockServer.once('listening',resolve));
const mockPort = (mockServer.address() as {port:number}).port;
process.env.VITE_SUPABASE_URL=`http://127.0.0.1:${mockPort}`;
process.env.VITE_SUPABASE_ANON_KEY='fixture-anon'; process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-service';
const app=express(); app.use(express.json()); app.use('/api/v1/admin',adminRouter);
const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/admin/contact-requests`;
async function request(path='',body?:unknown,authenticated=true){return fetch(origin+path,{method:body?'PATCH':'GET',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer fixture-session'}:{})},body:body?JSON.stringify(body):undefined});}
try {
  assert.equal((await request('',undefined,false)).status,401);
  role='user'; assert.equal((await request(`/${id}/archive`,{archived:true})).status,403); role='staff';
  permissions=['support.read']; assert.equal((await request(`/${id}/archive`,{archived:true})).status,403); permissions=['support.read','support.write'];
  assert.equal((await request(`/${id}/archive`,{archived:'true'})).status,400);
  assert.equal((await request(`/${id}/archive`,{archived:true,status:'closed'})).status,400);
  assert.equal((await request('/bad-id/archive',{archived:true})).status,400);
  assert.equal((await request('?archived=other')).status,400);
  assert.equal((await (await request()).json()).length,1);
  const archived=await (await request(`/${id}/archive`,{archived:true})).json();
  assert.ok(archived.archived_at); assert.equal(archived.status,'answered'); assert.equal(archived.response_text,'Recorded reply');
  assert.equal((await (await request()).json()).length,0);
  assert.equal((await (await request('?archived=true')).json()).length,1);
  const restored=await (await request(`/${id}/archive`,{archived:false})).json(); assert.equal(restored.archived_at,null); assert.equal(restored.status,'answered');
  assert.equal((await (await request()).json()).length,1);
  assert.equal((await request('/00000000-0000-4000-8000-000000000099/archive',{archived:true})).status,404);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.contact_requests'), /permission denied/);
  console.log('PASS: Support archive/restore, preserved replies/status, filtered inbox, validation and staff permissions. No hosted data changed.');
} finally { server.close(); mockServer.close(); await db.close(); }
