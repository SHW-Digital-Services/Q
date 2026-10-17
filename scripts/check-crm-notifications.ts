import assert from 'node:assert/strict';
import express from 'express';
import {createCrmNotificationsRouter} from '../server/routes/crmNotifications';
const tables:string[]=[];let permission=['support.read'];
const app=express();app.use('/api/crm/notifications',createCrmNotificationsRouter((async(req:any,res:any)=>{
 if(!req.headers.authorization){res.status(401).json({error:'Sign in'});return null;}
 if(req.headers.authorization==='Bearer user'){res.status(403).json({error:'Staff required'});return null;}
 return {role:req.headers.authorization==='Bearer admin'?'partner_admin':'staff',permissions:permission,serviceSupabase:{from(table:string){tables.push(table);const query:any={select(field:string){assert.equal(field,'created_at');return query;},order(){return query;},limit(){return Promise.resolve({data:[{created_at:'2026-10-08T12:00:00Z',body:'PRIVATE_NOT_RETURNED'}],error:null});}};return query;}}};
}) as any));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${(server.address() as any).port}/api/crm/notifications`;
try{
 assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{Authorization:'Bearer user'}})).status,403);
 let response=await fetch(url,{headers:{Authorization:'Bearer staff'}});let data=await response.json();assert.deepEqual(Object.keys(data.activity).sort(),['roadmap','ticket']);assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.match(response.headers.get('cache-control')||'',/no-store/);assert.deepEqual(tables.sort(),['contact_requests','feedback_roadmap']);
 permission=['crm.read'];data=await(await fetch(url,{headers:{Authorization:'Bearer staff'}})).json();assert.deepEqual(Object.keys(data.activity).sort(),['roadmap','ticket']);
 permission=[];data=await(await fetch(url,{headers:{Authorization:'Bearer staff'}})).json();assert.equal(Object.keys(data.activity).length,0);assert.ok(!('security' in data.activity));
 data=await(await fetch(url,{headers:{Authorization:'Bearer admin'}})).json();assert.deepEqual(Object.keys(data.activity).sort(),['roadmap','ticket']);
 console.log('PASS: CRM notification authentication, capability filtering, admin access, timestamp-only responses and private caching.');
}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
