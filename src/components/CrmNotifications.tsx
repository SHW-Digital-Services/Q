import React, {useEffect, useRef, useState} from 'react';
import {Bell, X} from 'lucide-react';
import {getSupabaseClient} from '../services/supabase';
import {useCrmDraftState} from '../hooks/useCrmDraftState';
import {combinedInboxFolders, type MailFolder} from '../services/mailFolders';

const labels:Record<string,string>={customers:'New CRM customer',activity:'CRM activity updated',tasks:'CRM task updated',communications:'New CRM communication',support:'Support activity updated',feedback:'New improvement suggestion',billing:'CRM payment activity',security:'Security activity updated',mail:'New unread email in Inbox',personalMail:'New unread email in your personal Inbox'};
export default function CrmNotifications(){
 const [enabled,setEnabled]=useCrmDraftState('crmDeviceNotifications',false);
 const [baseline,setBaseline]=useCrmDraftState<Record<string,string|number|null>>('crmNotificationBaseline',{});
 const latest=useRef(baseline);latest.current=baseline;
 const enabledRef=useRef(enabled);enabledRef.current=enabled;
 const [toasts,setToasts]=useState<{id:number;text:string}[]>([]);
 const [notice,setNotice]=useState('');
 const [health,setHealth]=useState('');
 const sequence=useRef(0),notifications=useRef<Notification[]>([]);
 const timers=useRef<Set<number>>(new Set());
 useEffect(()=>()=>{timers.current.forEach(window.clearTimeout);notifications.current.forEach(item=>item.close());},[]);
 function announce(keys:string[]){
  const text=[...new Set(keys.map(key=>labels[key]))].join(' · '),id=++sequence.current;
  setToasts(items=>[...items.slice(-2),{id,text}]);
  const timer=window.setTimeout(()=>{setToasts(items=>items.filter(item=>item.id!==id));timers.current.delete(timer);},12000);timers.current.add(timer);
  if(enabledRef.current && 'Notification' in window && Notification.permission==='granted')try{
   const n=new Notification('Q CRM',{body:text,tag:'q-crm-activity'});n.onclick=()=>{window.focus();n.close();};notifications.current.forEach(item=>item.close());notifications.current=[n];
  }catch{/* Toast remains available when native notifications are unsupported. */}
 }
 async function toggle(){
  if(enabled){setEnabled(false);notifications.current.forEach(item=>item.close());return;}
  if(!('Notification' in window)||!window.isSecureContext){setNotice('Device notifications are unavailable here. CRM toasts remain enabled.');return;}
  try{const permission=await Notification.requestPermission();if(permission==='granted'){setEnabled(true);setNotice('Device notifications enabled while Q CRM is open.');}else setNotice('Allow notifications in this site’s browser settings to enable device alerts. CRM toasts remain enabled.');}catch{setNotice('Device notifications could not be enabled. CRM toasts remain enabled.');}
 }
 useEffect(()=>{
  const controller=new AbortController();let pending=false,stopped=false;
  async function get(path:string){const client=getSupabaseClient();const session=client?(await client.auth.getSession()).data.session:null;if(!session){stopped=true;throw new Error('Sign in to receive CRM notifications.');}const response=await fetch(path,{headers:{Authorization:`Bearer ${session.access_token}`},signal:controller.signal,cache:'no-store',credentials:'same-origin'});if(response.status===401||response.status===403){if(path==='/api/crm/notifications')stopped=true;throw new Error('CRM notification access is unavailable.');}if(!response.ok)throw new Error('CRM notifications are temporarily unavailable.');return response.json();}
  async function poll(){
   if(pending||stopped)return;pending=true;
   const next:Record<string,string|number|null>={};let failed=false;
   try{
    const data=await get('/api/crm/notifications');Object.assign(next,data.activity);failed=!!data.unavailable?.length;
    // Mail access remains enforced by the existing office/personal mailbox APIs.
    const status=await get('/api/comms/status');
    const modes = [...(status.connected?[{path:'',key:'mail'}]:[]),...(status.personalAvailable?[{path:'/personal',key:'personalMail'}]:[])];
    await Promise.all(modes.map(async mode=>{try{const accounts=await get(`/api/comms${mode.path}/accounts`);const account=accounts.accounts?.[0]?.accountId;if(account){const data=await get(`/api/comms${mode.path}/accounts/${account}/folders`);next[mode.key]=combinedInboxFolders(data.folders as MailFolder[]).reduce((sum,item)=>sum+(item.unreadCount||0),0);}}catch{failed=true;}}));
   }catch{failed=true;}
   finally{
    if(!controller.signal.aborted){const previous=latest.current;const changed=Object.keys(next).filter(key=>key in previous && next[key]!==null && ((key==='mail'||key==='personalMail')?Number(next[key])>Number(previous[key]):Date.parse(String(next[key]))>(previous[key]?Date.parse(String(previous[key])):0)));if(changed.length)announce(changed);const merged={...previous,...next};latest.current=merged;setBaseline(merged);setHealth(failed?'Some CRM notifications are temporarily unavailable.':'');}pending=false;
   }
  }
  void poll();const timer=window.setInterval(()=>void poll(),30000);const visible=()=>{if(document.visibilityState==='visible')void poll();};document.addEventListener('visibilitychange',visible);
  return()=>{controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[setBaseline]);
 return <><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 px-4 py-2 text-sm text-slate-200"><span className="flex items-center gap-2"><Bell className="h-4 w-4"/>CRM notifications</span><button type="button" aria-pressed={enabled} onClick={()=>void toggle()} className="min-h-11 rounded-xl border border-white/20 px-3 py-2">{enabled?'Device notifications on':'Enable device notifications'}</button>{notice&&<p role="status" className="w-full text-xs">{notice}</p>}{health&&<p className="w-full text-xs text-amber-200">{health}</p>}</div><div className="fixed bottom-4 right-4 z-[100] max-w-[calc(100vw-2rem)] space-y-2">{toasts.map(toast=><aside key={toast.id} role="status" aria-live="polite" aria-label="CRM notification" className="flex items-center gap-3 rounded-2xl border border-violet-300/40 bg-slate-900 p-4 text-sm text-white shadow-xl"><Bell className="h-5 w-5 shrink-0"/><span>{toast.text}</span><button type="button" aria-label="Dismiss CRM notification" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center" onClick={()=>setToasts(items=>items.filter(item=>item.id!==toast.id))}><X className="h-5 w-5"/></button></aside>)}</div></>;
}
