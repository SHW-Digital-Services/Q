import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { hasPremium, journalInsights, validSnapshot } from '../server/premium-domain.js';
import { syncDecision, readSnapshot } from '../src/services/continuity.js';
import { setStorageUser, saveChatMessage, getChatHistory } from '../src/services/storage.js';
import { createPremiumRouter } from '../server/routes/premium.js';

const now = Date.parse('2026-09-16T12:00:00Z');
assert.equal(hasPremium(null),false);
assert.equal(hasPremium({status:'ACTIVE',current_period_end:'2026-09-15'},undefined,now),false);
assert.equal(hasPremium({status:'ACTIVE',current_period_end:'2026-10-01'},undefined,now),true);
assert.equal(hasPremium({status:'CANCELLED'},undefined,now),false);
assert.equal(hasPremium(null,'staff'),true);
assert.equal(hasPremium(null,'partner_admin'),true);
assert.equal(hasPremium(null,'user'),false);
const insights=journalInsights([
  {date:'2026-09-15',rating:5,tags:['Work','work']},
  {date:'2026-09-14',rating:3,tags:['work']},
  {date:'2026-09-13',rating:4,tags:['work']},
  {date:'2025-09-13',rating:1,tags:['work']},
  {date:'2026-09-17',rating:1,tags:['work']}
],30,new Date(now));
assert.equal(insights.average,4);assert.equal(insights.daysRecorded,3);assert.equal(insights.tags[0].count,3);
assert.equal(journalInsights([],30,new Date(now)).average,null);
const a={chat:[]},b={chat:[{id:'b'}]},c={chat:[{id:'c'}]};
assert.equal(syncDecision(a,null,null),'push');
assert.equal(syncDecision(a,b,null),'pull');
assert.equal(syncDecision(b,c,null),'conflict');
assert.equal(syncDecision(b,c,JSON.stringify(b)),'pull');
assert.equal(syncDecision(b,c,JSON.stringify(c)),'push');
assert.equal(syncDecision(b,b,null),'same');
assert.equal(validSnapshot({chat:[{id:'1',sender:'user',text:'hello',timestamp:'now'}]}),true);
assert.equal(validSnapshot({chat:[{id:'1',text:42}]}),false);
assert.equal(validSnapshot({security:[{pin:'1234'}]}),false);
console.log('PASS premium entitlement, insights, payload validation and sync conflict decisions');

const deviceData=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>deviceData.get(k)||null,setItem:(k:string,v:string)=>deviceData.set(k,v)},configurable:true});
Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
setStorageUser('account-a');saveChatMessage({id:'a',sender:'user',text:'Only A',timestamp:'now'},'account-a');
setStorageUser('account-b');saveChatMessage({id:'a2',sender:'q_ai',text:'Late A response',timestamp:'now'},'account-a');
assert.equal(getChatHistory('account-b').length,0);assert.equal(getChatHistory('account-a').length,2);
assert.equal(readSnapshot('account-b',['chat']).chat?.length,0);
assert.equal(readSnapshot('account-a',['chat']).chat?.length,2);
console.log('PASS separate account storage and late responses after switching accounts');
delete (globalThis as any).window;
delete (globalThis as any).localStorage;

// Real PostgreSQL semantics in an isolated, in-memory database; no hosted data.
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
await db.exec(await readFile(new URL('../supabase/migrations/20260916160930_premium_continuity.sql',import.meta.url),'utf8'));
for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>db.query('select * from public.premium_continuity'),/permission denied/);
  await assert.rejects(()=>db.query("select public.save_premium_continuity('00000000-0000-0000-0000-000000000001',0,'{}')"),/permission denied/);
  await db.exec('reset role');
}
await db.exec('set role service_role');
const save=async(revision:number,payload:unknown)=> (await db.query<{revision:number|null}>('select public.save_premium_continuity($1,$2,$3) as revision',['00000000-0000-0000-0000-000000000001',revision,JSON.stringify(payload)])).rows[0].revision;
assert.equal(await save(0,a),1);assert.equal(await save(0,b),null);
assert.equal(await save(1,b),2);assert.equal(await save(1,c),null);
assert.deepEqual((await db.query<{payload:unknown}>('select payload from premium_continuity')).rows[0].payload,b);
await db.exec('reset role');await db.exec("delete from auth.users where id='00000000-0000-0000-0000-000000000001'");
assert.equal((await db.query('select * from premium_continuity')).rows.length,0);
await db.close();
console.log('PASS migration, browser-role denial, atomic revisions, stale-write protection and account deletion cascade');

let paid=false;let cloud:any=null;let owner='';
const fakeDb:any={from:(table:string)=>{
  let deleting=false;
  const chain:any={select:()=>chain,delete:()=>{deleting=true;return chain;},eq:(_key:string,value:string)=>{owner=value;return chain;},maybeSingle:async()=>({data:table==='profiles'?{role:'user'}:table==='subscriptions'?(paid?{status:'ACTIVE'}:null):cloud,error:null}),then:(resolve:any)=>{if(deleting)cloud=null;resolve({error:null});}};return chain;
},rpc:async(_name:string,args:any)=>{owner=args.owner_id;if(args.expected_revision!==(cloud?.revision||0))return{data:null,error:null};cloud={payload:args.new_payload,revision:args.expected_revision+1};return{data:cloud.revision,error:null};}};
const app=express();app.use(express.json());app.use('/api/premium',createPremiumRouter({getServiceSupabase:()=>fakeDb,getAuthenticatedUser:async(req)=>req.headers.authorization==='Bearer test'?{user:{id:'account-a'}} as any:null}));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
const port=(server.address() as any).port;
const request=(path:string,method='GET',body?:unknown,auth=true)=>fetch(`http://127.0.0.1:${port}/api/premium/${path}`,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},...(body?{body:JSON.stringify(body)}:{})});
try{
  assert.equal((await request('programmes','GET',undefined,false)).status,401);
  assert.equal((await request('programmes')).status,403);
  assert.equal((await request('insights','POST',{records:[],days:30})).status,403);
  assert.equal((await request('continuity','PUT',{payload:{},revision:0})).status,403);
  paid=true;
  const catalog=await request('programmes');assert.equal(catalog.status,200);assert.equal((await catalog.json()).length,3);assert.equal(catalog.headers.get('cache-control'),'no-store');
  assert.equal((await request('insights','POST',{records:[{rating:99}],days:30})).status,400);
  assert.equal((await request('insights','POST',{records:[],days:30})).status,200);
  assert.equal((await request('continuity','PUT',{payload:{chat:[]},revision:0,userId:'other-account'})).status,200);
  assert.equal(owner,'account-a');
  assert.equal((await request('continuity','PUT',{payload:{chat:[]},revision:0})).status,409);
  paid=false;
  assert.equal((await request('continuity')).status,200);
  assert.equal((await request('continuity','DELETE')).status,200);assert.equal(cloud,null);
  console.log('PASS API authentication, premium gates, account ownership, conflict response and post-expiry export/delete');
}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
