import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { createFeedbackRouter } from '../server/routes/feedback';

const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create table profiles(id uuid primary key,role text,staff_permissions text[],preferred_name text);
create table password_reset_requests(status text,created_at timestamptz);
create table security_events(occurred_at timestamptz);
create table paypal_webhook_events(processed_at timestamptz);
create table privacy_requests(status text,completed_at timestamptz);
create table api_rate_limits(expires_at timestamptz);`);
for(const file of ['20260828000003_contact_requests.sql','20260916170403_crm_communications.sql','20261001103919_support_inbox_archive.sql','20261008001518_support_conversations.sql','20261008120641_feedback_roadmap.sql'])await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
const ids:Record<string,string>=Object.fromEntries(['a','b','read','write','both','admin','unverified'].map(key=>[key,randomUUID()]));
for(const id of Object.values(ids))await db.query('insert into auth.users values($1)',[id]);
const permissions:Record<string,string[]>= {read:['support.read'],write:['support.write'],both:['support.read','support.write'],admin:[]};
const tables=new Set(['feedback_suggestions','feedback_roadmap','feedback_events']);
class Query {
  private fields = '*'; private conditions: string[] = []; private values: unknown[] = [];
  private mode = 'select'; private payload: any; private sorts: string[] = []; private maximum?: number; private single = false;
  constructor(private table: string) { assert.ok(tables.has(table)); }
  private name(value: string) { assert.match(value,/^[a-z_]+$/); return value; }
  select(fields='*') { this.fields = fields; return this; }
  private where(field: string, operator: string, value: unknown) { this.values.push(value); this.conditions.push(`${this.name(field)} ${operator} $${this.values.length}`); return this; }
  eq(field:string,value:unknown) { return this.where(field,'=',value); }
  neq(field:string,value:unknown) { return this.where(field,'<>',value); }
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
const argTypes:Record<string,Record<string,string>>={
 submit_feedback:{p_id:'uuid',p_user_id:'uuid',p_title:'text',p_details:'text'},
 change_feedback_roadmap:{p_id:'uuid',p_actor_id:'uuid',p_action:'text',p_expected_revision:'bigint',p_title:'text',p_summary:'text',p_status:'text'},
 review_feedback:{p_changes:'jsonb',p_actor_id:'uuid',p_action:'text',p_roadmap_id:'uuid'}
};
const service={from:(table:string)=>new Query(table),async rpc(name:string,args:Record<string,unknown>){
 try{assert.ok(name in argTypes);const entries=Object.entries(args);entries.forEach(([key])=>assert.ok(key in argTypes[name]));
 const result=await db.query<{result:unknown}>(`select public.${name}(${entries.map(([key],i)=>`${key} => $${i+1}::${argTypes[name][key]}`).join(',')}) as result`,entries.map(([key,value])=>argTypes[name][key]==='jsonb'?JSON.stringify(value):value) as any[]);
 return{data:result.rows[0].result,error:null};}catch(error){return{data:null,error:{message:(error as Error).message,code:(error as any).code}};}
}};
const app=express();app.use(express.json());
const token=(req:express.Request)=>req.headers.authorization?.replace('Bearer ','')||'';
app.use('/api/feedback',createFeedbackRouter({db:()=>service,origin:()=>origin,
 authenticate:async req=>ids[token(req)]?{user:{id:ids[token(req)],email_confirmed_at:token(req)==='unverified'?null:'2026-10-08T00:00:00Z'},authClient:null} as any:null,
 staff:async(req,res)=>{const name=token(req);if(!ids[name]){res.status(401).json({error:'Authentication required.'});return null;}if(!(name in permissions)){res.status(403).json({error:'Staff required.'});return null;}return{identity:{user:{id:ids[name]}},role:name==='admin'?'partner_admin':'staff',permissions:permissions[name],serviceSupabase:service} as any;}
}));
app.use((err:any,_req:any,res:any,_next:any)=>res.status(err.status||500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
async function request(path:string,actor='',method='GET',body?:unknown,extra:Record<string,string>={}){return fetch(`${origin}/api/feedback${path}`,{method,headers:{...(actor?{Authorization:`Bearer ${actor}`}:{ }),...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},body:body!==undefined?JSON.stringify(body):undefined});}
async function json(path:string,actor='',method='GET',body?:unknown,status=200){const response=await request(path,actor,method,body);const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
try{
 const a=randomUUID(),b=randomUUID(),road=randomUUID();
 const suggestion={id:a,title:'Private suggestion A',details:'PRIVATE_A personal information stays private.'};
 assert.deepEqual(await json('/roadmap'),[]);
 await json('/suggestions','','GET',undefined,401);assert.equal((await request('/suggestions','','GET',undefined,{Cookie:'q_support_session=guest-fixture'})).status,401);await json('/suggestions','unverified','GET',undefined,401);
 await json('/staff/suggestions','a','GET',undefined,403);await json('/staff/roadmap','write','GET',undefined,403);
 await json('/staff/roadmap','read','POST',{id:road,title:'Better navigation',summary:'Make important tools easier to find.',status:'planned'},403);
 await json('/suggestions','a','POST',{...suggestion,user_id:ids.b},400);
 await json('/suggestions','a','POST',suggestion,201);await json('/suggestions','a','POST',suggestion,201);
 await json('/suggestions','a','POST',{...suggestion,title:'Different retry'},409);
 await json('/suggestions','a','POST',{...suggestion,id:randomUUID()},429);
 await json('/suggestions','b','POST',{id:b,title:'Private suggestion B',details:'PRIVATE_B identifying detail must stay private.'},201);
 const mine=await json('/suggestions','a');assert.equal(mine.length,1);assert.equal(mine[0].id,a);assert.equal(mine[0].roadmap,null);assert.ok(!('user_id' in mine[0]));assert.ok(!('roadmap_id' in mine[0]));
 const draft={id:road,title:'Better navigation',summary:'Make important tools easier to find.',status:'planned'};
 let item=await json('/staff/roadmap','both','POST',draft,201);assert.equal(item.revision,1);
 await json('/staff/roadmap','both','POST',draft,201);assert.deepEqual(await json('/roadmap'),[]);
 const review=(changes:any[],action='group',roadmapId:string|null=road)=>json('/staff/suggestions/review','both','POST',{changes,action,roadmapId});
 await review([{id:a,revision:1},{id:b,revision:1}]);
 assert.equal((await json('/suggestions','a'))[0].roadmap,null);
 await json('/staff/suggestions/review','both','POST',{changes:[{id:a,revision:2},{id:b,revision:1}],action:'review',roadmapId:null},409);
 assert.equal((await json('/staff/suggestions','both')).find((row:any)=>row.id===a).revision,2);
 const change=(action:string,revision:number,extras={})=>json(`/staff/roadmap/${road}`,'both','PATCH',{action,revision,...extras});
 item=await change('publish',1);assert.equal(item.revision,2);
 let published=await json('/roadmap');assert.equal(published[0].title,draft.title);
 assert.deepEqual(Object.keys(published[0]).sort(),['id','title','summary','status','published_at'].sort());
 assert.ok(!JSON.stringify(published).includes('PRIVATE_'));assert.equal((await json('/suggestions','a'))[0].roadmap.status,'planned');
 item=await change('save',2,{title:'Navigation improvements',summary:'A revised public summary ready for staff review.',status:'in_progress'});
 assert.equal((await json('/roadmap'))[0].title,draft.title);assert.equal((await json('/suggestions','a'))[0].roadmap.status,'planned');
 await json(`/staff/roadmap/${road}`,'both','PATCH',{action:'publish',revision:2},409);
 item=await change('publish',3);assert.equal((await json('/roadmap?status=in_progress')).length,1);assert.deepEqual(await json('/roadmap?status=planned'),[]);
 assert.equal((await request(`/staff/roadmap/${road}`,'both','PATCH',{action:'unpublish',revision:4},{Origin:'https://evil.example'})).status,403);
 item=await change('unpublish',4);assert.deepEqual(await json('/roadmap'),[]);assert.equal((await json('/suggestions','a'))[0].roadmap,null);
 item=await change('archive',5);assert.ok(item.archived_at);
 await json(`/staff/roadmap/${road}`,'both','PATCH',{action:'publish',revision:6},409);
 item=await change('restore',6);assert.equal(item.published,false);assert.equal(item.archived_at,null);
 await review([{id:a,revision:2}],'archive',null);assert.equal((await json('/staff/suggestions?archived=true','both')).length,1);
 await review([{id:a,revision:3}],'restore',null);assert.equal((await json('/staff/suggestions','both')).length,2);
 await json('/staff/suggestions/review','both','POST',{changes:[{id:a,revision:4},{id:a,revision:4}],action:'review',roadmapId:null},400);
 await json('/staff/suggestions/review','both','POST',{changes:[{id:a,revision:4},{id:randomUUID(),revision:1}],action:'review',roadmapId:null},404);
 assert.equal((await json('/staff/suggestions','both')).find((row:any)=>row.id===a).revision,4);
 const detail=await json(`/staff/roadmap/${road}`,'both');assert.ok(detail.events.length>=7);assert.ok(!JSON.stringify(detail.events).includes('PRIVATE_'));
 await json('/staff/roadmap','admin');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const table of tables)await assert.rejects(db.query(`select * from public.${table}`),/permission denied/);
  await assert.rejects(db.query('select public.submit_feedback($1,$2,$3,$4)',[randomUUID(),ids.a,'Denied','Must never be allowed directly.']),/permission denied/);
  await assert.rejects(db.query('select public.purge_expired_operational_data()'),/permission denied/);
  await db.exec('reset role');
 }
 await db.query("update feedback_suggestions set updated_at=now()-interval '366 days' where id=$1",[a]);
 const purge=await db.query<{result:any}>('select public.purge_expired_operational_data() as result');assert.equal(purge.rows[0].result.feedback_suggestions,1);
 assert.equal((await db.query('select * from feedback_events where suggestion_id=$1',[a])).rows.length,0);
 assert.equal((await json('/suggestions','b')).length,1);assert.equal((await json('/staff/roadmap','both')).length,1);
 await db.query('delete from auth.users where id=$1',[ids.b]);
 assert.equal((await db.query<{user_id:string|null}>('select user_id from feedback_suggestions where id=$1',[b])).rows[0].user_id,null);
 assert.equal((await json('/suggestions','a')).length,0);
 console.log('Feedback checks passed: ownership, permissions, retries, quota, atomic grouping, snapshots, revisions, archive, RLS, retention.');
} finally {await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
