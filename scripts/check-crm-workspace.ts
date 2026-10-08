import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { createSupportRouter } from '../server/routes/support';
import {createHelpCentreRouter} from '../server/routes/helpCentre';
import{syncOfficeEmailTickets,logCustomerOfficeEmail}from'../server/crmEmailTickets';
import { sendSupportEmail } from '../server/supportMail';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key references auth.users(id),role text,staff_permissions text[],preferred_name text);
create table public.password_reset_requests(status text,created_at timestamptz);
create table public.security_events(occurred_at timestamptz);
create table public.paypal_webhook_events(processed_at timestamptz);
create table public.privacy_requests(status text,completed_at timestamptz);
create table public.api_rate_limits(expires_at timestamptz);`);
await db.exec(await readFile('supabase/migrations/20260828000003_contact_requests.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20260916170403_crm_communications.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261001103919_support_inbox_archive.sql','utf8'));
const legacy = randomUUID();
await db.query(`insert into contact_requests(id,email,subject,message,status,response_text) values($1,'legacy@example.test','Legacy question','Legacy question content','answered','Historical staff reply')`,[legacy]);
await db.exec(await readFile('supabase/migrations/20261008001518_support_conversations.sql','utf8'));
assert.equal((await db.query<{ status:string }>('select status from contact_requests where id=$1',[legacy])).rows[0].status,'resolved');
assert.equal((await db.query('select * from support_messages where request_id=$1',[legacy])).rows.length,1);
assert.equal((await db.query('select * from support_notifications')).rows.length,0);
await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant all on storage.objects to anon,authenticated;create policy fixture_open on storage.objects for all to anon,authenticated using(true) with check(true);`);
await db.exec(await readFile('supabase/migrations/20261008125504_help_centre_support_attachments.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261008131436_crm_ticket_workspace.sql','utf8'));
const userA: string = randomUUID(), userB: string = randomUUID(), staffId: string = randomUUID(), noAccessStaff: string = randomUUID();
for (const id of [userA,userB,staffId,noAccessStaff]) await db.query('insert into auth.users(id) values($1)',[id]);
await db.query(`insert into profiles(id,role,staff_permissions) values($1,'staff',array['support.read','support.write']),($2,'staff',array['crm.read'])`,[staffId,noAccessStaff]);

// A small query adapter executes actual PostgreSQL against the migration while
// the production Express router performs all ownership/capability checks.
const tables = new Set(['contact_requests','support_messages','support_events','support_access','support_notifications','profiles','support_attachments','support_storage_cleanup','help_articles']);
class Query {
  private fields = '*'; private conditions: string[] = []; private values: unknown[] = [];
  private mode = 'select'; private payload: any; private sorts: string[] = []; private maximum?: number; private single = false;
  constructor(private table: string) { assert.ok(tables.has(table)); }
  private name(value: string) { assert.match(value,/^[a-z_]+$/); return value; }
  select(fields='*') { this.fields = fields; return this; }
  private where(field: string, operator: string, value: unknown) { this.values.push(value); this.conditions.push(`${this.name(field)} ${operator} $${this.values.length}`); return this; }
  eq(field:string,value:unknown) { return this.where(field,'=',value); }
  neq(field:string,value:unknown) { return this.where(field,'<>',value); }
  lt(field:string,value:unknown) { return this.where(field,'<',value); }
  gt(field:string,value:unknown) { return this.where(field,'>',value); }
  is(field:string,value:null) { assert.equal(value,null); this.conditions.push(`${this.name(field)} is null`); return this; }
  not(field:string,operator:string,value:null) { assert.equal(operator,'is'); assert.equal(value,null); this.conditions.push(`${this.name(field)} is not null`); return this; }
  in(field:string,values:unknown[]) { const positions=values.map(value=>{this.values.push(value);return `$${this.values.length}`;}); this.conditions.push(`${this.name(field)} in (${positions.join(',')})`); return this; }
  order(field:string,options?:{ascending?:boolean}) { this.sorts.push(`${this.name(field)} ${options?.ascending === false?'desc':'asc'}`); return this; }
  limit(value:number) { this.maximum=value; return this; }
  maybeSingle() { this.single=true; return this; }
  insert(payload:unknown) { this.mode='insert';this.payload=payload;return this; }
  update(payload:unknown) { this.mode='update';this.payload=payload;return this; }
  delete() { this.mode='delete';return this; }
  async run() {
    try {
      const where=this.conditions.length?` where ${this.conditions.join(' and ')}`:'';
      const fields=this.fields==='*'?'*':this.fields.split(',').map(field=>this.name(field)).join(',');
      let sql='';
      if (this.mode==='select') sql=`select ${fields} from public.${this.table}${where}${this.sorts.length?` order by ${this.sorts.join(',')}`:''}${this.maximum?` limit ${this.maximum}`:''}`;
      else if(this.mode==='delete') sql=`delete from public.${this.table}${where} returning ${fields}`;
      else {
        const names=Object.keys(this.payload).map(name=>this.name(name));
        const positions=names.map(name=>{this.values.push(this.payload[name]);return `$${this.values.length}`;});
        sql=this.mode==='insert'?`insert into public.${this.table}(${names.join(',')}) values(${positions.join(',')}) returning ${fields}`:`update public.${this.table} set ${names.map((name,index)=>`${name}=${positions[index]}`).join(',')}${where} returning ${fields}`;
      }
      const result=await db.query(sql,this.values as any[]);
      if(this.single && result.rows.length>1) throw new Error('Multiple rows');
      return { data:this.single?result.rows[0] || null:result.rows,error:null };
    } catch(error) { return { data:null,error:{message:(error as Error).message} }; }
  }
  then(resolve:any,reject:any) { return this.run().then(resolve,reject); }
}
const argTypes: Record<string,Record<string,string>> = {
  schedule_support_ticket:{p_request:'uuid',p_actor:'uuid',p_action:'text',p_due:'timestamptz',p_priority:'text'},
  log_office_customer_email:{p_user:'uuid',p_email:'text',p_inbound:'boolean',p_account:'text',p_folder:'text',p_message:'text',p_subject:'text',p_received:'timestamptz'},
  create_support_request:{p_id:'uuid',p_user_id:'uuid',p_email:'text',p_name:'text',p_category:'text',p_subject:'text',p_body:'text'},
  change_support_request:{p_request_id:'uuid',p_actor_id:'uuid',p_staff:'boolean',p_action:'text',p_message_id:'uuid',p_body:'text',p_status:'text',p_assignee:'uuid'},
  change_help_article:{p_id:'uuid',p_actor:'uuid',p_action:'text',p_revision:'bigint',p_content:'jsonb'},
  reserve_support_attachment:{p_id:'uuid',p_request:'uuid',p_author:'uuid',p_staff:'boolean',p_internal:'boolean',p_name:'text',p_mime:'text',p_size:'integer',p_hash:'text'},
  exchange_support_access:{p_link_hash:'text',p_session_hash:'text'}
};
const objects=new Map<string,Buffer>();let uploadFailure=false,cleanupFailure=false;
const service = { storage:{from:(bucket:string)=>{assert.equal(bucket,'q-support-private');return{async upload(path:string,bytes:Buffer,options:any){assert.equal(options.upsert,false);if(uploadFailure)return{error:{message:'Fixture storage outage'}};if(objects.has(path))return{error:{statusCode:'409'}};objects.set(path,Buffer.from(bytes));return{error:null};},async download(path:string){return objects.has(path)?{data:new Blob([objects.get(path)!]),error:null}:{data:null,error:{message:'Missing'}};},async remove(paths:string[]){if(cleanupFailure)return{error:{message:'Fixture cleanup failure'}};paths.forEach(path=>objects.delete(path));return{error:null};}}}}, from:(table:string)=>new Query(table), async rpc(name:string,args:Record<string,unknown>) {
  try {
    assert.ok(name in argTypes);const entries=Object.entries(args);entries.forEach(([key])=>assert.ok(key in argTypes[name]));
    const query=`select public.${name}(${entries.map(([key],index)=>`${key} => $${index+1}::${argTypes[name][key]}`).join(',')}) as result`;
    const result=await db.query<{result:unknown}>(query,entries.map(([key,value])=>argTypes[name][key]==='jsonb'?JSON.stringify(value):value) as any[]);
    return {data:result.rows[0].result,error:null};
  } catch(error) { return {data:null,error:{message:(error as Error).message}}; }
} };
let emailFailure = false;
const deliveries:{ email:string;link:string }[]=[];
const app=express();app.use(express.json());
app.use('/api/support',createSupportRouter({ db:()=>service,
  authenticate:async req=>{
    const id=req.headers.authorization?.replace('Bearer ','');
    if(!id || ![userA,userB,staffId,noAccessStaff].includes(id)) return null;
    return {user:{id,email:id===userA?'user-a@example.test':'user-b@example.test',email_confirmed_at:'2026-10-08T00:00:00Z',is_anonymous:false},authClient:null} as any;
  },
  staff:async(req,res)=>{
    const id=req.headers.authorization?.replace('Bearer ','');
    if(!id){res.status(401).json({error:'Authentication required.'});return null;}
    if(![staffId,noAccessStaff].includes(id)){res.status(403).json({error:'Staff required.'});return null;}
    return {identity:{user:{id}},serviceSupabase:service,role:'staff',permissions:id===staffId?['support.read','support.write']:['crm.read']} as any;
  }, email:async(email,link)=>{if(emailFailure)throw new Error('provider timeout');deliveries.push({email,link});},origin:()=>origin
}));
app.use('/api/help-centre',createHelpCentreRouter(()=>service as any,async(req,res)=>{const actor=req.headers.authorization?.replace('Bearer ','');if(actor!==staffId){res.status(actor?403:401).json({error:'Staff required'});return null;}return{identity:{user:{id:staffId}},role:'staff',permissions:['support.read','support.write'],serviceSupabase:service} as any;}));
app.use((err:any,_req:any,res:any,_next:any)=>res.status(err.status || 500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
async function request(path:string,options:{actor?:string;method?:string;body?:unknown;cookie?:string;origin?:string}={}) {
  return fetch(`${origin}/api/support${path}`,{method:options.method||'GET',headers:{...(options.actor?{Authorization:`Bearer ${options.actor}`}:{ }),...(options.cookie?{Cookie:options.cookie}:{}),...(options.origin?{Origin:options.origin}:{}),...(options.body!==undefined?{'Content-Type':'application/json'}:{})},body:options.body!==undefined?JSON.stringify(options.body):undefined});
}
async function json(path:string,options:Parameters<typeof request>[1]={},status=200) {const response=await request(path,options);const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
try {
  assert.equal((await request('/requests')).status,401);
  assert.equal((await request('/staff/requests',{actor:userA})).status,403);
  assert.equal((await request('/staff/requests',{actor:noAccessStaff})).status,403);
  const id=randomUUID();const body={id,name:'Test',category:'technical',subject:'Test request',message:'A product support question'};
  await json('/requests',{actor:userA,method:'POST',body},201);
  await json('/requests',{actor:userA,method:'POST',body},201); // safe creation retry
  assert.equal((await json('/requests',{actor:userA})).length,1);
  assert.equal((await json('/requests',{actor:userB})).length,0);
  assert.equal((await request(`/requests/${id}`,{actor:userB})).status,404);
  assert.equal((await request(`/requests/${id}/messages`,{actor:userB,method:'POST',body:{id:randomUUID(),body:'Forbidden reply'}})).status,404);
  assert.equal((await request(`/requests/${id}`,{actor:userB,method:'PATCH',body:{status:'closed'}})).status,404);
  assert.equal((await request('/requests',{actor:userA,method:'POST',body:{...body,id:randomUUID(),user_id:userB}})).status,400);
  assert.equal((await request('/requests',{actor:userA,method:'POST',body:null})).status,400);
  assert.equal((await request('/requests',{actor:userA,method:'POST',body:{...body,id:randomUUID()}})).status,429);
  const note=randomUUID();await json(`/staff/requests/${id}/messages`,{actor:staffId,method:'POST',body:{id:note,body:'Private internal note',internal:true}},201);
  assert.equal(deliveries.length,0);
  assert.equal((await json(`/requests/${id}`,{actor:userA})).messages.length,0);
  assert.equal((await json(`/requests/${id}`,{actor:userA})).events.length,0);
  const message=randomUUID();const reply={id:message,body:'Customer-facing staff reply',internal:false};
  await json(`/staff/requests/${id}/messages`,{actor:staffId,method:'POST',body:reply},201);
  await json(`/staff/requests/${id}/messages`,{actor:staffId,method:'POST',body:reply},201);
  assert.equal(deliveries.length,1);assert.equal(deliveries[0].email,'user-a@example.test');assert.match(deliveries[0].link,/\/app\?tab=help&request=/);
  let conversation=await json(`/requests/${id}`,{actor:userA});assert.equal(conversation.messages.length,1);assert.equal(conversation.request.status,'waiting_for_user');assert.equal(conversation.request.email,undefined);assert.equal(conversation.request.user_id,undefined);
  assert.equal((await request(`/requests/${id}/messages`,{actor:userA,method:'POST',body:{id:randomUUID(),body:'Attempted internal note',internal:true}})).status,400);
  await json(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'assignment',assignedTo:staffId}});
  assert.equal((await json('/staff/requests?assigned=me',{actor:staffId})).length,1);
  assert.equal((await request(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'assignment',assignedTo:userB}})).status,400);
  await json(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'status',status:'resolved'}});
  await json(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'archive'}});
  const userMessage=randomUUID();await json(`/requests/${id}/messages`,{actor:userA,method:'POST',body:{id:userMessage,body:'Please reopen this request.'}},201);
  conversation=await json(`/staff/requests/${id}`,{actor:staffId});assert.equal(conversation.request.status,'in_progress');assert.equal(conversation.request.archived_at,null);assert.equal(conversation.messages.length,3);
  assert.ok(conversation.events.some((event:any)=>event.action==='assignment' && event.actor_id===staffId && event.assigned_to===staffId));
  await json(`/requests/${id}`,{actor:userA,method:'PATCH',body:{status:'closed'}});
  await json(`/requests/${id}`,{actor:userA,method:'PATCH',body:{status:'in_progress'}});
  emailFailure=true;await json(`/staff/requests/${id}/messages`,{actor:staffId,method:'POST',body:{id:randomUUID(),body:'Saved despite a provider failure',internal:false}},201);emailFailure=false;
  conversation=await json(`/staff/requests/${id}`,{actor:staffId});assert.ok(conversation.messages.some((message:any)=>message.notification_status==='failed'));
  const failedNotice=conversation.messages.find((message:any)=>message.notification_status==='failed');
  assert.equal((await request(`/staff/requests/${id}/notifications/${failedNotice.id}/retry`,{actor:staffId,method:'POST',body:{checkedSent:false}})).status,400);
  await json(`/staff/requests/${id}/notifications/${failedNotice.id}/retry`,{actor:staffId,method:'POST',body:{checkedSent:true}});
  assert.equal((await request(`/staff/requests/${id}/notifications/${failedNotice.id}/retry`,{actor:staffId,method:'POST',body:{checkedSent:true}})).status,409);
  conversation=await json(`/staff/requests/${id}`,{actor:staffId});assert.equal(conversation.messages.find((message:any)=>message.id===failedNotice.id).notification_status,'sent');
  assert.equal((await request(`/staff/requests/${legacy}/notifications/${failedNotice.id}/retry`,{actor:staffId,method:'POST',body:{checkedSent:true}})).status,404);
  // A matching account email never claims an old guest request.
  const guestId=randomUUID();await db.query(`insert into contact_requests(id,email,subject,message) values($1,'user-a@example.test','Guest question','Guest question content')`,[guestId]);
  await db.query(`insert into crm_communications(contact_request_id,direction,body) values($1,'inbound','Guest question content')`,[guestId]);
  assert.equal((await request(`/requests/${guestId}`,{actor:userA})).status,404);
  const before=deliveries.length;
  const wrong=await json('/access',{method:'POST',body:{id:guestId,email:'wrong@example.test'}},202);
  assert.equal(deliveries.length,before);
  const right=await json('/access',{method:'POST',body:{id:guestId,email:'user-a@example.test'}},202);assert.deepEqual(wrong,right);
  const token=new URLSearchParams(new URL(deliveries.at(-1)!.link).hash.slice(1)).get('access')!;
  const access=await request('/access/exchange',{method:'POST',body:{token}});assert.equal(access.status,200);
  const cookie=access.headers.get('set-cookie')!.split(';')[0];assert.match(access.headers.get('set-cookie')!,/HttpOnly/);assert.match(access.headers.get('set-cookie')!,/SameSite=Strict/i);
  assert.equal((await request('/access/exchange',{method:'POST',body:{token}})).status,401);
  assert.equal((await json('/requests',{cookie})).length,1);
  assert.equal((await request(`/requests/${id}`,{cookie})).status,404);
  assert.equal((await request(`/requests/${guestId}`,{actor:'invalid',cookie})).status,401);
  assert.equal((await request(`/requests/${guestId}/messages`,{cookie,origin:'https://foreign.example',method:'POST',body:{id:randomUUID(),body:'CSRF'}})).status,403);
  await json(`/requests/${guestId}/messages`,{cookie,method:'POST',body:{id:randomUUID(),body:'Verified guest reply'}},201);
  await json('/access/logout',{cookie,method:'POST'});assert.equal((await request('/requests',{cookie})).status,401);
  const expired='x'.repeat(43);await db.query(`insert into support_access(token_hash,request_id,kind,expires_at) values($1,$2,'link',now()-interval '1 minute')`,[createHash('sha256').update(expired).digest('hex'),guestId]);
  assert.equal((await request('/access/exchange',{method:'POST',body:{token:expired}})).status,401);
  // Database grants deny direct client access and privileged RPC execution.
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    for(const table of tables) if(table!=='profiles') await assert.rejects(db.query(`select * from ${table}`),/permission denied/);
    await assert.rejects(db.query(`select public.change_support_request($1,$2,false,'reply',$3,'Unauthorized')`,[id,userB,randomUUID()]),/permission denied/);
    await assert.rejects(db.query(`select public.exchange_support_access('denied','denied')`),/permission denied/);
    await assert.rejects(db.query(`select public.create_support_request($1,$2,'forbidden@example.test',null,'general','Forbidden','Unauthorized request')`,[randomUUID(),userB]),/permission denied/);
    await db.exec('reset role');
  }
  // Retention uses last activity, preserves open/recent conversations and cascades.
  await db.query(`update contact_requests set status='closed',created_at=now()-interval '500 days',updated_at=now()-interval '366 days' where id=$1`,[guestId]);
  await db.query(`update contact_requests set status='resolved',created_at=now()-interval '500 days',updated_at=now() where id=$1`,[id]);
  await db.query('select purge_expired_operational_data()');
  assert.equal((await db.query('select * from contact_requests where id=$1',[guestId])).rows.length,0);
  assert.equal((await db.query('select * from support_messages where request_id=$1',[guestId])).rows.length,0);
  assert.equal((await db.query('select * from crm_communications where contact_request_id=$1',[guestId])).rows.length,0);
  assert.equal((await db.query('select * from contact_requests where id=$1',[id])).rows.length,1);
  // Exercise the real office notification transport against fake Zoho endpoints.
  const mailEnv={ZOHO_MAIL_CLIENT_ID:'fixture-client',ZOHO_MAIL_CLIENT_SECRET:'fixture-secret',ZOHO_MAIL_REFRESH_TOKEN:'fixture-refresh',ZOHO_MAIL_COOKIE_KEY:'a'.repeat(64),ZOHO_MAIL_REGION:'eu',APP_URL:'https://www.q-ai.online'};
  const previousEnv=Object.fromEntries(Object.keys(mailEnv).map(key=>[key,process.env[key]]));
  Object.assign(process.env,mailEnv);
  let mailPayload:any;
  try {
    const fetcher:typeof fetch=async(input,init)=>{
      const url=String(input);
      if(url.endsWith('/oauth/v2/token'))return new Response(JSON.stringify({access_token:'fixture-access',expires_in:3600}),{status:200});
      if(url.endsWith('/api/accounts'))return new Response(JSON.stringify({status:{code:200},data:[{accountId:'123456789',primaryEmailAddress:'office@q-ai.online'}]}),{status:200});
      assert.equal(url,'https://mail.zoho.eu/api/accounts/123456789/messages');mailPayload=JSON.parse(String(init?.body));
      return new Response(JSON.stringify({status:{code:200},data:{messageId:'987654321'}}),{status:200});
    };
    const link='https://www.q-ai.online/support#access=fixture-private-token';
    await sendSupportEmail('recipient@example.test',link,fetcher);
    assert.equal(mailPayload.toAddress,'recipient@example.test');assert.equal(mailPayload.fromAddress,'office@q-ai.online');assert.equal(mailPayload.subject,'Your Q support request');assert.equal(mailPayload.mailFormat,'plaintext');assert.ok(mailPayload.content.includes(link));assert.ok(!mailPayload.content.includes('Customer-facing staff reply'));assert.equal(mailPayload.ccAddress,undefined);assert.equal(mailPayload.bccAddress,undefined);
    await assert.rejects(sendSupportEmail('recipient@example.test',link,async()=>new Response('{}',{status:403})));
  } finally {for(const [key,value] of Object.entries(previousEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  const attachment=randomUUID(),internalFile=randomUUID();
  const upload=async(attachmentId:string,actor:string,bytes:Buffer=Buffer.from('Safe text fixture.'),internal=false,originHeader='',requestId=id,cookieValue='')=>fetch(`${origin}/api/support/${actor===staffId?'staff/':''}requests/${requestId}/attachments`,{method:'POST',headers:{...(actor?{Authorization:`Bearer ${actor}`}:{Cookie:cookieValue}),'Content-Type':'application/octet-stream','X-Attachment-Id':attachmentId,'X-File-Name':'fixture.txt','X-Internal-File':String(internal),...(originHeader?{Origin:originHeader}:{})},body:bytes});
  assert.equal((await upload(attachment,userB)).status,404);assert.equal((await upload(attachment,userA,Buffer.from('Safe text fixture.'),true)).status,403);
  assert.equal((await upload(attachment,userA,Buffer.from('<svg onload="bad"/>'))).status,400);assert.equal((await upload(attachment,userA,Buffer.alloc(2097153))).status,413);
  assert.equal((await upload(attachment,userA,Buffer.from('Safe text fixture.'),false,'https://evil.example')).status,403);
  uploadFailure=true;assert.equal((await upload(attachment,userA)).status,503);assert.equal((await json(`/requests/${id}/attachments`,{actor:userA})).length,0);uploadFailure=false;
  assert.equal((await upload(attachment,userA)).status,201);assert.equal((await upload(attachment,userA)).status,201);assert.equal(objects.size,1);
  assert.equal((await upload(attachment,userA,Buffer.from('Changed fixture.'))).status,409);
  assert.equal((await upload(internalFile,staffId,Buffer.from('Private staff fixture.'),true)).status,201);
  const files=await json(`/requests/${id}/attachments`,{actor:userA});assert.equal(files.length,1);assert.equal(files[0].canRemove,true);assert.ok(!('object_path' in files[0]));assert.ok(!('author_id' in files[0]));assert.equal((await json(`/staff/requests/${id}/attachments`,{actor:staffId})).length,2);
  assert.equal((await request(`/requests/${id}/attachments/${internalFile}`,{actor:userA})).status,404);assert.equal((await request(`/requests/${id}/attachments/${attachment}`,{actor:userB})).status,404);
  const fileResponse=await request(`/requests/${id}/attachments/${attachment}`,{actor:userA});assert.equal(fileResponse.headers.get('content-type'),'application/octet-stream');assert.match(fileResponse.headers.get('content-disposition')||'',/attachment/);assert.equal(await fileResponse.text(),'Safe text fixture.');
  for(let i=0;i<8;i++)assert.equal((await upload(randomUUID(),userA)).status,201);assert.equal((await upload(randomUUID(),userA)).status,409);
  cleanupFailure=true;const removed=await json(`/requests/${id}/attachments/${attachment}`,{actor:userA,method:'DELETE'});assert.equal(removed.cleanupPending,true);assert.equal((await request(`/requests/${id}/attachments/${attachment}`,{actor:userA})).status,404);cleanupFailure=false;await json('/staff/attachments/cleanup',{actor:staffId,method:'POST'});assert.ok(!objects.has(`${id}/${attachment}`));
  const guestRequest=randomUUID(),sessionToken='g'.repeat(43);await db.query("insert into contact_requests(id,email,subject,message) values($1,'guest@example.test','Guest file','A guest support file request.')",[guestRequest]);await db.query("insert into support_access(token_hash,request_id,kind,expires_at) values($1,$2,'session',now()+interval '1 day')",[createHash('sha256').update(sessionToken).digest('hex'),guestRequest]);const guestCookie='q_support_session='+sessionToken,guestFile=randomUUID();assert.equal((await upload(guestFile,'',Buffer.from('Guest attachment.'),false,'',guestRequest,guestCookie)).status,201);assert.equal((await request(`/requests/${guestRequest}/attachments/${guestFile}`,{cookie:guestCookie})).status,200);
  await db.query("update contact_requests set status='closed',updated_at=now()-interval '366 days' where id=$1",[guestRequest]);await db.query('select purge_expired_operational_data()');assert.equal((await db.query('select * from support_storage_cleanup where object_path=$1',[`${guestRequest}/${guestFile}`])).rows.length,1);await json('/staff/attachments/cleanup',{actor:staffId,method:'POST'});assert.ok(!objects.has(`${guestRequest}/${guestFile}`));
  const help=async(path='',body?:unknown,actor=staffId)=>fetch(`${origin}/api/help-centre${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${actor}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const published=await(await help('/articles',undefined,'')).json();assert.ok(published.length>=40);const articleId=randomUUID(),content={title:'Fixture FAQ',category:'Account',summary:'A useful answer to a common question.',body:'This answer contains enough detail to be useful.',kind:'faq'};
  assert.equal((await help('/staff/articles',undefined,userA)).status,403);
  let article=await(await help('/staff/articles/'+articleId,{action:'save',revision:0,content})).json();assert.equal(article.revision,1);assert.equal((await(await help('/articles')).json()).some((row:any)=>row.id===articleId),false);
  article=await(await help('/staff/articles/'+articleId,{action:'publish',revision:1})).json();assert.equal(article.revision,2);
  article=await(await help('/staff/articles/'+articleId,{action:'save',revision:2,content:{...content,body:'Draft changes remain private until staff republish.'}})).json();assert.equal(article.revision,3);assert.equal((await(await help('/articles')).json()).find((row:any)=>row.id===articleId).body,content.body);
  assert.equal((await help('/staff/articles/'+articleId,{action:'publish',revision:2})).status,409);
  await help('/staff/articles/'+articleId,{action:'archive',revision:3});assert.equal((await(await help('/articles')).json()).some((row:any)=>row.id===articleId),false);await help('/staff/articles/'+articleId,{action:'restore',revision:4});assert.equal((await(await help('/articles')).json()).some((row:any)=>row.id===articleId),false);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('q-support-private','forbidden')"),/row-level security/);await assert.rejects(db.query('select public.reserve_support_attachment($1,$2,$3,false,false,$4,$5,1,$6)',[randomUUID(),id,userA,'denied.txt','text/plain','a'.repeat(64)]),/permission denied/);await db.exec('reset role');}
  const due='2026-10-20T12:30:00Z';
  await json(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'due',dueAt:due}});
  await json(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'priority',priority:'urgent'}});
  const scheduled=await json(`/staff/requests/${id}`,{actor:staffId});assert.equal(scheduled.request.priority,'urgent');assert.equal(Date.parse(scheduled.request.due_at),Date.parse(due));
  assert.equal((await request(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'due',dueAt:'invalid'}})).status,400);
  assert.equal((await request(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'priority',priority:'danger'}})).status,400);
  assert.equal((await request(`/staff/requests/${id}`,{actor:noAccessStaff,method:'PATCH',body:{action:'due',dueAt:null}})).status,403);
  const user={id:userA,email:'user-a@example.test'};
  const inbound={messageId:'80001',folderId:'20001',fromAddress:user.email,toAddress:'office@q-ai.online',subject:'Question',receivedTime:Date.now(),summary:'PRIVATE_EMAIL_BODY'};
  await logCustomerOfficeEmail(service,user,'10001',inbound,true);await logCustomerOfficeEmail(service,user,'10001',inbound,true);
  assert.equal((await db.query("select * from contact_requests where email_key='10001:80001'")).rows.length,1);
  const linked=(await db.query<any>("select * from crm_communications where external_id='10001:80001'")).rows;assert.equal(linked.length,1);assert.equal(linked[0].user_id,userA);assert(!JSON.stringify(linked).includes('PRIVATE_EMAIL_BODY'));
  await logCustomerOfficeEmail(service,user,'10001',{...inbound,messageId:'80002'},false);assert.equal((await db.query("select * from contact_requests where email_key='10001:80002'")).rows.length,0);
  const fakeDb={...service,auth:{admin:{listUsers:async()=>({data:{users:[{...user,email_confirmed_at:'2026-01-01'},{id:userB,email:'unknown@example.test',email_confirmed_at:null}]}})}}};
  const fakeClient={json:async(path:string)=>path.endsWith('/folders')?[{folderId:'20001',folderType:'Inbox',folderName:'Inbox'},{folderId:'20002',folderType:'Drafts',folderName:'Drafts'}]:[inbound,{...inbound,messageId:'80003',fromAddress:'unknown@example.test'}]} as any;
  const synced=await syncOfficeEmailTickets(fakeDb,fakeClient,'10001');assert.equal(synced.logged,1);assert.equal(synced.hasMore,false);assert.equal((await db.query("select * from contact_requests where email_key='10001:80003'")).rows.length,0);
  await json(`/staff/requests/${id}`,{actor:staffId,method:'PATCH',body:{action:'due',dueAt:null}});assert.equal((await json(`/staff/requests/${id}`,{actor:staffId})).request.due_at,null);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select public.schedule_support_ticket($1,$2,\'due\',null,null)',[id,staffId]),/permission denied/);await assert.rejects(db.query('select public.log_office_customer_email($1,$2,true,\'10001\',\'20001\',\'80001\',\'Question\',now())',[userA,user.email]),/permission denied/);await db.exec('reset role');}
  console.log('PASS CRM: due dates/clear dates; priority; capability checks; real SQL email logging; idempotent tickets/ledger; outbound without duplicate tickets; verified customer matching; private body exclusions; service-only RPCs. Support and Release 3 checks also passed.');

} finally { server.close();await db.close(); }
