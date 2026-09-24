import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePremium } from './PremiumContext';
import { useTheme } from './ThemeContext';
import { useLanguage, supportedLanguages } from './LanguageContext';
import { premiumRequest } from '../services/premium';
import { continuityKeys, downloadSnapshot, Kind, readSnapshot, Snapshot, syncDecision } from '../services/continuity';
type Config={enabled:boolean;kinds:Kind[];baseline:string|null;last:string|null};
const defaults:Config={enabled:false,kinds:['guides','programmes'],baseline:null,last:null};
const Context=createContext<any>(null);
export function ContinuityProvider({children}:{children:React.ReactNode}) {
  const {userId,premium}=usePremium();const key=`q_continuity_v1:${userId}`;
  const {theme,setTheme}=useTheme();const {language,setLanguage}=useLanguage();
  const [config,setConfig]=useState<Config>(()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{return defaults;}});
  const [status,setStatus]=useState('');const [conflict,setConflict]=useState(false);const busy=useRef(false);const alive=useRef(true);const configRef=useRef(config);configRef.current=config;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const save=(value:Config)=>{localStorage.setItem(key,JSON.stringify(value));configRef.current=value;setConfig(value);};
  useEffect(()=>{window.dispatchEvent(new Event('q-local-change'));},[theme,language]);
  useEffect(()=>{const pause=()=>save({...configRef.current,enabled:false,baseline:null});window.addEventListener('q-local-cleared',pause);return()=>window.removeEventListener('q-local-cleared',pause);},[]);
  const run=async(resolution?:'push'|'pull')=>{
    const settings=configRef.current;
    if(busy.current||!premium||!settings.enabled)return;
    busy.current=true;setStatus('Syncing…');
    try{
      const local=readSnapshot(userId,settings.kinds);
      const cloud=await premiumRequest('continuity','GET',undefined,userId);
      if(!alive.current||configRef.current!==settings)return;
      const remote:Snapshot|null=cloud.payload ? Object.fromEntries(settings.kinds.map(k=>[k,cloud.payload[k]||[]])) : null;
      const decision=resolution||syncDecision(local,remote,settings.baseline);
      if(decision==='conflict'){setConflict(true);setStatus('Both copies have changes. Choose which copy to keep.');return;}
      if(JSON.stringify(readSnapshot(userId,settings.kinds))!==JSON.stringify(local)){setStatus('New local edits are waiting to sync.');return;}
      let accepted=local;
      if(decision==='push')await premiumRequest('continuity','PUT',{payload:{...cloud.payload,...local},revision:cloud.revision},userId);
      if(!alive.current||configRef.current!==settings)return;
      if(decision==='pull' && remote){
        accepted=remote;
        // A local recovery copy is retained before replacing any selected data.
        localStorage.setItem(`q_continuity_recovery:${userId}`,JSON.stringify(local));
        for(const kind of settings.kinds)localStorage.setItem(`${continuityKeys[kind]}:${userId}`,JSON.stringify(remote[kind]||[]));
        const display=remote.preferences?.[0] as {theme?:string;language?:keyof typeof supportedLanguages}|undefined;
        if(display?.theme==='light'||display?.theme==='dark'){localStorage.setItem('theme',display.theme);setTheme(display.theme);}
        if(display?.language&&display.language in supportedLanguages){localStorage.setItem('q_language',display.language);setLanguage(display.language);}
        window.dispatchEvent(new Event('q-cloud-applied'));
      }
      save({...settings,baseline:JSON.stringify(accepted),last:new Date().toISOString()});setConflict(false);setStatus('Selected data is up to date.');
    }catch(e){if(alive.current)setStatus((e as Error).message);}finally{busy.current=false;}
  };
  useEffect(()=>{
    if(!config.enabled||!premium)return;
    const refresh=()=>{void run();};let debounce:ReturnType<typeof setTimeout>;
    const changed=()=>{clearTimeout(debounce);debounce=setTimeout(refresh,1500);};
    refresh();const timer=setInterval(refresh,30000);window.addEventListener('q-local-change',changed);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);clearTimeout(debounce);window.removeEventListener('q-local-change',changed);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);};
  },[config.enabled,config.kinds.join(','),premium]);
  const remove=async()=>{if(busy.current){setStatus('A sync is finishing. Please retry deleting the cloud copy in a moment.');return;}save({...configRef.current,enabled:false,baseline:null});try{await premiumRequest('continuity','DELETE',undefined,userId);setConflict(false);setStatus('Cloud copy deleted. Local data remains.');}catch(e){setStatus((e as Error).message);}};
  return <Context.Provider value={{config,save,status,conflict,run,remove}}>{children}</Context.Provider>;
}
export function ContinuitySettings(){
  const {premium,userId,upgrade}=usePremium();const {config,save,status,conflict,run,remove}=useContext(Context);
  const [error,setError]=useState('');
  return <section className="my-5 rounded-2xl border border-violet-200 bg-white p-5"><h2 className="text-lg font-bold">Cross-device continuity <span className="text-xs text-violet-700">Premium</span></h2><p className="my-3 text-sm text-slate-600">Opt in on each device to keep selected data in your Q account. Selected content is stored in Q’s cloud; this is not end-to-end encryption. Device locks and passwords are never synced.</p>
    {!premium && <button onClick={upgrade} className="rounded-xl bg-violet-700 px-4 py-2 font-bold text-white">Explore Premium</button>}
    <fieldset disabled={config.enabled||!premium} className="my-3 grid grid-cols-2 gap-3"><legend className="mb-2 text-sm font-semibold">Choose what to sync (pause to change)</legend>{(Object.keys(continuityKeys) as Kind[]).map(k=><label key={k} className="flex gap-2 text-sm"><input type="checkbox" checked={config.kinds.includes(k)} onChange={e=>save({...config,kinds:e.target.checked?[...config.kinds,k].sort():config.kinds.filter((v:Kind)=>v!==k),baseline:null})}/>{{journal:'Journal entries',moods:'Mood check-ins',guides:'Saved guides',chat:'Chat history',programmes:'Programme progress and reflections',preferences:'Language and appearance'}[k]}</label>)}</fieldset>
    <p className="mb-3 text-xs text-slate-500">Only selected categories sync on this device. Deselecting a category pauses its sync; previously uploaded data remains in your account until you delete the cloud copy.</p>
    <div className="flex flex-wrap gap-2"><button disabled={!premium&&!config.enabled||config.kinds.length===0} onClick={()=>save({...config,enabled:!config.enabled})} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">{config.enabled?'Pause continuity':'Enable selected continuity'}</button>{config.enabled&&premium&&<button onClick={()=>run()} className="rounded-lg border px-3 py-2 text-sm">Sync now</button>}<button onClick={async()=>{try{downloadSnapshot(await premiumRequest('continuity','GET',undefined,userId));}catch(e){setError((e as Error).message);}}} className="rounded-lg border px-3 py-2 text-sm">Export cloud copy</button><button onClick={()=>{if(window.confirm('Delete the cloud continuity copy? Local data will remain on your devices. Pause continuity on other devices first to prevent re-upload.'))void remove();}} className="rounded-lg border px-3 py-2 text-sm text-rose-700">Delete cloud copy</button></div>
    {config.enabled&&!premium&&<p className="mt-3 text-sm">Continuity is paused until premium access is available. Your existing data can still be exported or deleted.</p>}
    <p role="status" className="mt-3 text-sm">{status||'Continuity is off until you enable it.'}</p>{config.last&&<p className="text-xs text-slate-500">Last completed sync: {new Date(config.last).toLocaleString()}</p>}{error&&<p role="alert">{error}</p>}
    {conflict&&<div className="mt-4 rounded-xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-950"><p className="mb-3 font-medium">No data has been replaced. Export both copies before choosing. Using the cloud copy also keeps a recovery copy on this device.</p><div className="flex flex-wrap gap-2"><button className="rounded border border-amber-500 bg-white px-3 py-2 font-semibold text-slate-900 hover:bg-amber-50" onClick={()=>downloadSnapshot(readSnapshot(userId,config.kinds))}>Export this device</button><button className="rounded border border-amber-500 bg-white px-3 py-2 font-semibold text-slate-900 hover:bg-amber-50" onClick={()=>run('push')}>Keep this device’s copy</button><button className="rounded border border-amber-500 bg-white px-3 py-2 font-semibold text-slate-900 hover:bg-amber-50" onClick={()=>run('pull')}>Use cloud copy</button></div></div>}
    <button className="mt-3 text-xs underline" onClick={()=>{const recovery=localStorage.getItem(`q_continuity_recovery:${userId}`);if(recovery)downloadSnapshot(JSON.parse(recovery));else setError('No recovery copy has been needed on this device.');}}>Export local recovery copy</button>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Guides and chats saved before this update</summary><p className="my-2">Older guides and chat were shared by this browser. Import them only if they belong to you. Existing account data is kept.</p><button className="rounded border p-2" onClick={()=>{try{for(const kind of ['guides','chat'] as const){const old=JSON.parse(localStorage.getItem(continuityKeys[kind])||'[]');const current=readSnapshot(userId,[kind])[kind]||[];const ids=new Set(current.map((v:any)=>v.id));const merged=[...current,...old.filter((v:any)=>!ids.has(v.id))];localStorage.setItem(`${continuityKeys[kind]}:${userId}`,JSON.stringify(merged));}window.dispatchEvent(new Event('q-cloud-applied'));window.dispatchEvent(new Event('q-local-change'));setError('Existing device guides and chat imported into this account.');}catch{setError('Unable to import older device data.');}}}>Import my older device guides and chat</button></details>
  </section>;
}
