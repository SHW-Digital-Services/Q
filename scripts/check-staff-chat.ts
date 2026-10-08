import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createStaffChatRouter, chatVisibility } from '../server/routes/staffChat';

const db = new PGlite();
await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table profiles(id uuid primary key, preferred_name text, role text);");
await db.exec(await readFile(new URL('../supabase/migrations/20261008210238_staff_chat.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261008211129_staff_chat_private_messages.sql', import.meta.url), 'utf8'));
const id = '11111111-1111-4111-8111-111111111111';
const recipient = '22222222-2222-4222-8222-222222222222';
await db.exec(`insert into profiles values ('${id}','Scott','staff');`);
await db.exec(`insert into profiles values ('${recipient}','Admin','partner_admin');`);
await db.exec(`set role authenticated;`);
await assert.rejects(db.query('select * from staff_chat_messages'), /permission denied/);
await db.exec('reset role;');
await assert.rejects(db.query(`insert into staff_chat_messages(request_id,user_id,display_name,role,body) values ('${id}','${id}','Scott','staff','')`), /check constraint/);
await assert.rejects(db.query(`insert into staff_chat_messages(request_id,user_id,recipient_id,display_name,role,body) values ('${id}','${id}','${id}','Scott','staff','Self')`), /check constraint/);
let writes: any[] = [];
let filters: string[] = []; let targetRole = 'partner_admin';
const app = express(); app.use(express.json());
app.use('/chat', createStaffChatRouter((async (req: any, res: any) => {
  if (!req.headers.authorization) { res.status(401).json({error:'Sign in'}); return null; }
  if (req.headers.authorization === 'Bearer customer') { res.status(403).json({error:'Staff required'}); return null; }
  return { identity: {user:{id}}, role: req.headers.authorization === 'Bearer admin' ? 'partner_admin' : 'staff', serviceSupabase: { from(table: string) {
    const q: any = { select(){return q;},eq(){return q;},gt(){return q;},gte(){return q;},in(){return q;},order(){return q;},limit(){return q;},is(field: string, value: unknown){filters.push(`${field}.is.${value}`);return q;},or(value: string){filters.push(value);return q;},
      maybeSingle(){return Promise.resolve({data:{role:targetRole}});},
      single(){return Promise.resolve({data:{preferred_name:'Scott'}});},
      upsert(value: any){ writes.push(value);return Promise.resolve({error:null}); },
      insert(value: any){writes.push(value);return Promise.resolve({error:null});},
      then(resolve: any){resolve({data:table==='staff_chat_presence'?[{user_id:id,profiles:{preferred_name:'Scott',role:'staff'}}]:[],error:null});} };
    return q;
  } } };
}) as any));
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const url = `http://127.0.0.1:${(server.address() as any).port}/chat`;
const post = (path: string, body: any, token='staff') => fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
try {
  for (const path of ['/sync','/messages','/leave','/history']) {
    assert.equal((await post(path,{},'')).status,401);
    assert.equal((await post(path,{},'customer')).status,403);
  }
  assert.equal(writes.length,0);
  assert.equal((await post('/sync',{session:'invalid'})).status,400);
  assert.equal((await post('/messages',{id,body:' '})).status,400);
  assert.equal((await post('/messages',{id,body:'x'.repeat(2001)})).status,400);
  const sync=await post('/sync',{session:id}); assert.equal(sync.status,200);
  assert.match(sync.headers.get('cache-control') || '', /no-store/);
  assert.equal((await sync.json()).users.length,1);
  assert.equal(filters.at(-1), chatVisibility(id));
  assert.equal(chatVisibility(id),`recipient_id.is.null,user_id.eq.${id},recipient_id.eq.${id}`);
  assert.equal((await post('/messages',{id,body:'Hello',user_id:'forged',role:'partner_admin'})).status,201);
  assert.equal(writes.at(-1).user_id,id); assert.equal(writes.at(-1).role,'staff');
  assert.equal(writes.at(-1).recipient_id,null);
  assert.equal((await post('/messages',{id,body:'Private',recipient})).status,201);
  assert.equal(writes.at(-1).recipient_id,recipient);
  targetRole='user';
  assert.equal((await post('/messages',{id,body:'Private',recipient})).status,400);
  assert.equal((await post('/messages',{id,body:'Private',recipient:id})).status,400);
  assert.equal((await post('/history',{recipient:'malformed'})).status,400);
  for (const token of ['staff','admin']) {
    filters=[];
    assert.equal((await post('/sync',{session:id},token)).status,200);
    assert.deepEqual(filters,[chatVisibility(id)]);
    filters=[];
    assert.equal((await post('/history',{recipient},token)).status,200);
    assert.ok(filters.includes(`and(user_id.eq.${id},recipient_id.eq.${recipient}),and(user_id.eq.${recipient},recipient_id.eq.${id})`));
    filters=[];
    assert.equal((await post('/history',{},token)).status,200);
    assert.ok(filters.includes('recipient_id.is.null'));
  }
  console.log('PASS: chat migrations, direct database denial, authentication, public/private recipient validation, participant-only reads for Staff and Admins, and server-owned sender identity.');
} finally { await new Promise<void>(resolve=>server.close(()=>resolve())); await db.close(); }
