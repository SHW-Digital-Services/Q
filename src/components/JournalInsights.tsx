import React, { useState } from 'react';
import { PremiumGate, usePremium } from '../contexts/PremiumContext';
import { getDailyMoodLogs, getJournalEntries } from '../services/storage';
import { premiumRequest } from '../services/premium';
type Result = {count:number;daysRecorded:number;average:number|null;daily:Array<{date:string;average:number}>;tags:Array<{tag:string;count:number;average:number}>};
export function JournalInsights() {
  const {userId} = usePremium(); const [days,setDays]=useState(30);const [result,setResult]=useState<Result|null>(null); const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const calculate = async () => {
    setBusy(true);setError('');setResult(null);
    const moods=getDailyMoodLogs(userId); const dates=new Set(moods.map(m=>m.date));
    const records=[...moods.map(m=>({date:m.date,rating:m.rating,tags:m.tags||[]})),...getJournalEntries(userId).filter(j=>!dates.has(j.date)).map(j=>({date:j.date,rating:j.moodRating,tags:j.moodTags||[]}))];
    const end=new Date().toISOString().slice(0,10);const startDate=new Date(`${end}T00:00:00Z`);startDate.setUTCDate(startDate.getUTCDate()-days+1);const start=startDate.toISOString().slice(0,10);
    try{setResult(await premiumRequest('insights','POST',{records:records.filter(r=>r.date>=start&&r.date<=end),days},userId));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <PremiumGate title="Advanced journal insights" description="Explore your recorded mood patterns over 30 days, 90 days or a year.">
    <p className="mb-3 text-sm text-slate-600">Generate insights sends only dates, ratings and tags to Q for calculation. Journal text is not sent, and no AI provider is used. Daily check-ins take priority over journal ratings on the same date.</p>
    <div className="flex flex-wrap gap-3"><label className="text-sm">Time period <select value={days} onChange={e=>{setDays(Number(e.target.value));setResult(null);}} className="rounded-lg border p-2">{[30,90,365].map(d=><option key={d} value={d}>{d} days</option>)}</select></label><button disabled={busy} onClick={calculate} className="rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Calculating…':'Generate insights'}</button></div>
    {error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}
    {result && <div className="mt-4">{result.count===0 ? <p>No recorded moods in this period. Add a check-in or journal entry to get started.</p> : <><div className="grid grid-cols-2 gap-3"><p className="rounded-xl bg-violet-50 p-4"><strong className="block text-2xl">{result.average}/5</strong>Average daily mood</p><p className="rounded-xl bg-violet-50 p-4"><strong className="block text-2xl">{result.daysRecorded}</strong>Days recorded</p></div><details className="my-4"><summary className="cursor-pointer font-semibold">Daily mood history</summary><div className="mt-3 max-h-64 overflow-auto">{result.daily.map(d=><div key={d.date} className="my-2 flex items-center gap-3 text-sm"><span>{d.date}</span><meter aria-label={`Mood on ${d.date}`} min={1} max={5} value={d.average} className="flex-1"/><span>{d.average}/5</span></div>)}</div></details><h3 className="font-bold">Patterns by tag</h3>{result.tags.length ? <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col">Tag</th><th scope="col">Records</th><th scope="col">Average rating</th></tr></thead><tbody>{result.tags.map(t=><tr key={t.tag}><th scope="row" className="py-2 font-normal">{t.tag}</th><td>{t.count}</td><td>{t.average}/5</td></tr>)}</tbody></table></div>:<p className="mt-2 text-sm">A tag needs at least three records before a pattern is shown.</p>}<p className="mt-4 text-xs text-slate-500">Missing days are not treated as low moods. These are descriptive patterns, not diagnoses or evidence that a tag caused a mood.</p></>}</div>}
  </PremiumGate>;
}
