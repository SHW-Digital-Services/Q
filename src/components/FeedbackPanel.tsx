import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { useCrmDraftState } from '../hooks/useCrmDraftState';
import { feedbackApi } from '../services/feedback';
import { roadmapStatusLabels, type FeedbackSuggestion } from '../shared/feedback';

const empty={id:'',title:'',details:''};
const control='mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900';

export default function FeedbackPanel() {
  const [draft,setDraft]=useCrmDraftState('feedbackSuggestion',empty);
  const [suggestions,setSuggestions]=useState<FeedbackSuggestion[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const generation=useRef(0),mutation=useRef(false);
  const load=useCallback(async(signal?:AbortSignal)=>{
    const version=++generation.current;setLoading(true);
    try{const result=await feedbackApi<FeedbackSuggestion[]>('/suggestions',{signal});if(version===generation.current && !signal?.aborted)setSuggestions(result);}
    catch(err){if(version===generation.current && !signal?.aborted)setError(err instanceof Error?err.message:'Unable to load your suggestions.');}
    finally{if(version===generation.current && !signal?.aborted)setLoading(false);}
  },[]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>{controller.abort();generation.current++;};},[load]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(mutation.current)return;mutation.current=true;setBusy(true);setError('');setNotice('');
    const submission={...draft,id:draft.id||crypto.randomUUID()};setDraft(submission);
    try{await feedbackApi('/suggestions',{method:'POST',body:submission});setDraft(empty);setNotice('Thank you — your suggestion has been saved privately for Q to review.');await load();}
    catch(err){setError(err instanceof Error?err.message:'Unable to save your suggestion.');}
    finally{mutation.current=false;setBusy(false);}
  }
  const edit=(patch:Partial<typeof empty>)=>setDraft(current=>({...current,...patch,id:''}));
  return <section aria-labelledby="suggest-improvement-heading" className="space-y-5 text-slate-900">
    <div><h2 id="suggest-improvement-heading" className="flex items-center gap-2 text-xl font-bold"><Lightbulb className="h-5 w-5 text-violet-600" />Suggest an improvement</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Tell us what would make Q more useful. Your suggestion stays private to you and authorised staff. Q may publish a separately written, anonymous summary on the <a href="/roadmap" className="font-semibold text-violet-700 underline">product roadmap</a>.</p><p className="mt-1 text-xs text-slate-500">Need help with an account or an error? Use My requests above.</p></div>
    {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-900">{notice}</p>}
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm font-semibold">Suggestion title<input required minLength={3} maxLength={160} value={draft.title} onChange={event=>edit({title:event.target.value})} className={control} /></label>
      <label className="block text-sm font-semibold">What would help?<textarea required minLength={10} maxLength={5000} rows={4} value={draft.details} onChange={event=>edit({details:event.target.value})} className={control} /></label>
      <p className="text-xs leading-relaxed text-slate-500">Share the improvement and why it would help. Leave out passwords, payment details, private journal content and other people’s identifying information. No private app content is attached automatically.</p>
      <button type="submit" className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Saving…':'Submit suggestion'}</button>
    </fieldset></form>
    <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">My suggestions</h3><button type="button" aria-label="Refresh my suggestions" disabled={busy||loading} onClick={()=>{setError('');void load();}} className="rounded-xl border border-violet-200 p-3 text-violet-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button></div>
      {loading && <p role="status" className="text-sm text-slate-500">Loading your suggestions…</p>}
      {!loading && !suggestions.length && <p className="text-sm text-slate-500">You have not submitted any suggestions yet.</p>}
      {suggestions.map(suggestion=><article key={suggestion.id} className="rounded-2xl border border-violet-200 bg-white p-4" data-no-translate><div className="flex flex-wrap justify-between gap-2"><h4 className="break-words font-bold">{suggestion.title}</h4><span className="text-xs font-semibold text-violet-700">{suggestion.roadmap?roadmapStatusLabels[suggestion.roadmap.status]:'Under review'}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{suggestion.details}</p><p className="mt-3 text-xs text-slate-500">Submitted {new Date(suggestion.created_at).toLocaleString()}{suggestion.review_state==='reviewed' && !suggestion.roadmap?' · Reviewed; no public update yet.':''}</p>{suggestion.roadmap && <a href={`/roadmap#roadmap-${suggestion.roadmap.id}`} className="mt-2 block text-sm font-semibold text-violet-700 underline">Roadmap: {suggestion.roadmap.title}</a>}</article>)}
      {suggestions.length===200 && <p className="text-xs text-slate-500">Showing your 200 most recent suggestions.</p>}
    </div>
  </section>;
}
