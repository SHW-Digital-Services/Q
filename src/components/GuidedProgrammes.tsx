import React, { useEffect, useState } from 'react';
import { PremiumGate, usePremium } from '../contexts/PremiumContext';
import { premiumRequest } from '../services/premium';
type Programme = {id:string;title:string;summary:string;sessions:Array<{title:string;body:string;prompt:string;action:string}>};
export type ProgrammeProgress = {id:string;completed:number[];notes:Record<string,string>};
export function GuidedProgrammes() {
  const {premium,userId} = usePremium();
  const [items,setItems] = useState<Programme[]>([]); const [error,setError] = useState('');
  const key = `q_programmes_v1:${userId}`;
  const [progress,setProgress] = useState<ProgrammeProgress[]>(() => {try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}});
  const [selected,setSelected] = useState(''); const [step,setStep] = useState(0);
  useEffect(()=>{const refresh=()=>{try{setProgress(JSON.parse(localStorage.getItem(key)||'[]'));}catch{setError('Unable to read saved programme progress.');}};window.addEventListener('q-cloud-applied',refresh);return()=>window.removeEventListener('q-cloud-applied',refresh);},[key]);
  useEffect(() => {let active=true;if(premium) premiumRequest('programmes','GET',undefined,userId).then(data=>{if(active)setItems(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[premium,userId]);
  const update = (value:ProgrammeProgress) => {
    const next=[...progress.filter(p=>p.id!==value.id),value];
    try {localStorage.setItem(key,JSON.stringify(next));setProgress(next);setError('');window.dispatchEvent(new CustomEvent('q-local-change',{detail:{key}}));}catch{setError('Unable to save progress on this device. Free some storage and try again.');}
  };
  const programme=items.find(p=>p.id===selected); const saved=progress.find(p=>p.id===selected)||{id:selected,completed:[],notes:{}};
  return <PremiumGate title="Guided programmes" description="Short, self-paced exercises for boundaries, connection and confidence. Pause or skip an exercise whenever you need.">
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {!items.length && !error && <p role="status">Loading programmes…</p>}
    {!programme ? <div className="grid gap-3 sm:grid-cols-3">{items.map(p=><button key={p.id} onClick={()=>{setSelected(p.id);setStep(0);}} className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-left text-slate-950 hover:bg-violet-100"><h3 className="font-bold text-slate-950">{p.title}</h3><p className="my-2 text-sm text-slate-800">{p.summary}</p><p className="text-xs font-semibold text-violet-900">{progress.find(x=>x.id===p.id)?.completed.length||0} of {p.sessions.length} sessions complete</p></button>)}</div> : <div className="text-slate-950">
      <button className="mb-3 text-sm font-bold text-violet-700 underline" onClick={()=>setSelected('')}>All programmes</button><h3 className="text-lg font-bold text-slate-950">{programme.title}</h3>
      <div className="my-3 flex flex-wrap gap-2">{programme.sessions.map((s,i)=><button key={s.title} aria-pressed={i===step} onClick={()=>setStep(i)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${i===step?'bg-violet-700 text-white':'bg-white text-slate-950'}`}>{saved.completed.includes(i)?'✓ ':''}Session {i+1}</button>)}</div>
      <h4 className="font-bold text-slate-950">{programme.sessions[step].title}</h4><p className="my-3 text-sm leading-6 text-slate-800">{programme.sessions[step].body}</p>
      <label className="block text-sm font-semibold text-slate-950">{programme.sessions[step].prompt}<textarea maxLength={5000} value={saved.notes[step]||''} onChange={e=>update({...saved,notes:{...saved.notes,[step]:e.target.value}})} className="mt-2 block min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal text-slate-950 placeholder:text-slate-500" placeholder="Optional reflection — saved on this device" /></label>
      <p className="my-3 text-sm"><strong>Your next step: </strong>{programme.sessions[step].action}</p>
      <button onClick={()=>update({...saved,completed:saved.completed.includes(step)?saved.completed.filter(s=>s!==step):[...saved.completed,step]})} className="rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white">{saved.completed.includes(step)?'Mark incomplete':'Complete session'}</button>
      {saved.completed.length===programme.sessions.length && <p role="status" className="mt-3 font-semibold text-emerald-700">Programme complete. You can revisit your reflections any time.</p>}
      <p className="mt-3 text-xs text-slate-600">Reflections stay on this device unless you enable programme continuity in Profile. These exercises are not therapy.</p>
    </div>}
  </PremiumGate>;
}
