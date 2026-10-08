import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { useCrmDraftState } from '../hooks/useCrmDraftState';
import { feedbackApi } from '../services/feedback';
import { roadmapStatuses, roadmapStatusLabels, type RoadmapDraft, type RoadmapStatus, type StaffFeedbackSuggestion } from '../shared/feedback';

type Editor={id:string;title:string;summary:string;status:RoadmapStatus;revision:number};
type Event={id:string;actor_id:string|null;action:string;revision:number;created_at:string};
const empty:Editor={id:'',title:'',summary:'',status:'under_review',revision:0};
const control='rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50';
const card='rounded-2xl border border-white/10 bg-slate-900 p-4';
const editorFor=(item:RoadmapDraft):Editor=>({id:item.id,title:item.title,summary:item.summary,status:item.status,revision:item.revision});

export default function FeedbackWorkspace() {
  const [suggestions,setSuggestions]=useState<StaffFeedbackSuggestion[]>([]);
  const [roadmap,setRoadmap]=useState<RoadmapDraft[]>([]);
  const [drafts,setDrafts]=useCrmDraftState<Record<string,Editor>>('feedbackRoadmapDrafts',{});
  const [selected,setSelected]=useState('');
  const [checked,setChecked]=useState<string[]>([]);
  const [target,setTarget]=useState('');
  const [filters,setFilters]=useState({state:'',archived:'false',roadmap:''});
  const [search,setSearch]=useState('');
  const [publicationReviewed,setPublicationReviewed]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [events,setEvents]=useState<Event[]>([]);
  const generation=useRef(0),mutation=useRef(false);
  const saved=roadmap.find(item=>item.id===selected);
  const draft=drafts[selected] || (saved?editorFor(saved):empty);
  const stale=!!saved && draft.revision!==saved.revision;
  const dirty=!!saved && (stale || draft.title!==saved.title || draft.summary!==saved.summary || draft.status!==saved.status);
  const visible=suggestions.filter(item=>!search.trim() || `${item.title} ${item.details}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedRows=suggestions.filter(item=>checked.includes(item.id));
  const report=(err:unknown)=>setError(err instanceof Error?err.message:'Unable to complete this feedback action.');
  const load=useCallback(async(signal?:AbortSignal)=>{
    const version=++generation.current;setLoading(true);
    try{
      const [rows,items]=await Promise.all([
        feedbackApi<StaffFeedbackSuggestion[]>(`/staff/suggestions?${new URLSearchParams(filters)}`,{signal}),
        feedbackApi<RoadmapDraft[]>('/staff/roadmap',{signal})
      ]);
      if(version===generation.current && !signal?.aborted){setSuggestions(rows);setRoadmap(items);setChecked([]);setPublicationReviewed(false);}
    }catch(err){if(version===generation.current && !signal?.aborted)report(err);}
    finally{if(version===generation.current && !signal?.aborted)setLoading(false);}
  },[filters]);
  useEffect(()=>{const controller=new AbortController();setError('');void load(controller.signal);return()=>{controller.abort();generation.current++;};},[load]);
  useEffect(()=>{
    setPublicationReviewed(false);setEvents([]);
    if(!selected || selected==='new')return;
    const controller=new AbortController();
    void feedbackApi<{item:RoadmapDraft;events:Event[]}>(`/staff/roadmap/${selected}`,{signal:controller.signal}).then(result=>{
      if(!controller.signal.aborted){setEvents(result.events);setRoadmap(items=>items.map(item=>item.id===selected?result.item:item));}
    }).catch(err=>{if(!controller.signal.aborted)report(err);});
    return()=>controller.abort();
  },[selected]);
  const edit=(patch:Partial<Editor>)=>{setPublicationReviewed(false);setDrafts(current=>({...current,[selected]:{...draft,...patch}}));};
  const clearDraft=(key:string)=>setDrafts(current=>{const next={...current};delete next[key];return next;});
  async function refreshEvents(id:string){const result=await feedbackApi<{events:Event[]}>(`/staff/roadmap/${id}`);setEvents(result.events);}
  async function save(event:React.FormEvent){
    event.preventDefault();if(mutation.current)return;mutation.current=true;setBusy(true);setError('');setNotice('');
    const submission={...draft,id:draft.id||crypto.randomUUID()};setDrafts(current=>({...current,[selected]:submission}));
    try{
      const result=await feedbackApi<RoadmapDraft>(selected==='new'?'/staff/roadmap':`/staff/roadmap/${selected}`,{method:selected==='new'?'POST':'PATCH',body:selected==='new'?{id:submission.id,title:submission.title,summary:submission.summary,status:submission.status}:{action:'save',revision:submission.revision,title:submission.title,summary:submission.summary,status:submission.status}});
      clearDraft(selected);setRoadmap(items=>[result,...items.filter(item=>item.id!==result.id)]);setSelected(result.id);setPublicationReviewed(false);setNotice('Draft saved. The public roadmap has not changed.');
      await Promise.all([load(),refreshEvents(result.id)]);
    }catch(err){report(err);}finally{mutation.current=false;setBusy(false);}
  }
  async function changeRoadmap(action:string){
    if(!saved || mutation.current)return;
    if(action==='publish' && (dirty||!publicationReviewed))return;
    if(['archive','unpublish'].includes(action) && !window.confirm(action==='archive'?'Archive this roadmap item and remove it from the public roadmap? Suggestions and history will be retained.':'Remove this item from the public roadmap? Its draft and linked suggestions will be retained.'))return;
    mutation.current=true;setBusy(true);setError('');setNotice('');
    try{
      const result=await feedbackApi<RoadmapDraft>(`/staff/roadmap/${saved.id}`,{method:'PATCH',body:{action,revision:saved.revision}});
      setRoadmap(items=>items.map(item=>item.id===result.id?result:item));setPublicationReviewed(false);
      setNotice(action==='publish'?'Reviewed summary published.':action==='restore'?'Roadmap draft restored. Publish separately when ready.':'Roadmap item updated.');
      await Promise.all([load(),refreshEvents(result.id)]);
    }catch(err){report(err);}finally{mutation.current=false;setBusy(false);}
  }
  async function review(action:string,rows:StaffFeedbackSuggestion[]=selectedRows){
    if(!rows.length || mutation.current || (action==='group'&&!target))return;
    if(action==='archive' && !window.confirm(`Archive ${rows.length} suggestion(s)? They can be restored from Archived.`))return;
    mutation.current=true;setBusy(true);setError('');setNotice('');
    try{
      await feedbackApi('/staff/suggestions/review',{method:'POST',body:{changes:rows.map(item=>({id:item.id,revision:item.revision})),action,...(action==='group'?{roadmapId:target==='unlink'?null:target}:{})}});
      setNotice(action==='group'?'Grouping saved. Original suggestions remain private.':'Suggestion review saved.');
      await load();if(saved)await refreshEvents(saved.id);
    }catch(err){report(err);}finally{mutation.current=false;setBusy(false);}
  }
  return <section className="mt-6 space-y-5 text-slate-100" aria-labelledby="feedback-workspace-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="feedback-workspace-heading" className="flex items-center gap-2 text-xl font-bold"><Lightbulb className="h-5 w-5 text-violet-300" />Feedback &amp; roadmap</h2><p className="mt-1 text-sm text-slate-400">Review private suggestions, group duplicates and publish separately written summaries.</p></div><div className="flex gap-2"><a href="/roadmap" className={control}>View public roadmap</a><button aria-label="Refresh feedback workspace" disabled={busy||loading} className={control} onClick={()=>{setError('');void load();}}><RefreshCw className="h-4 w-4" /></button></div></div>
    {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading && <p role="status" className="text-sm text-slate-400">Loading feedback workspace…</p>}
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="min-w-0 space-y-3" aria-labelledby="private-suggestions-heading"><h3 id="private-suggestions-heading" className="font-bold">Private suggestions</h3>
        <fieldset disabled={busy} className="flex flex-wrap gap-2"><label className="text-xs">View<select aria-label="Suggestion view" value={filters.archived} className={`ml-2 ${control}`} onChange={event=>setFilters(current=>({...current,archived:event.target.value}))}><option value="false">Inbox</option><option value="true">Archived</option></select></label><label className="text-xs">Review<select aria-label="Suggestion review filter" value={filters.state} className={`ml-2 ${control}`} onChange={event=>setFilters(current=>({...current,state:event.target.value}))}><option value="">All</option><option value="new">New</option><option value="reviewed">Reviewed</option></select></label><label className="text-xs">Group<select aria-label="Suggestion group filter" value={filters.roadmap} className={`ml-2 max-w-full ${control}`} onChange={event=>setFilters(current=>({...current,roadmap:event.target.value}))}><option value="">All groups</option><option value="unlinked">Ungrouped</option>{roadmap.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label></fieldset>
        <label className="block text-xs">Search private suggestions<input value={search} onChange={event=>setSearch(event.target.value)} className={`mt-1 block w-full ${control}`} /></label>
        {filters.archived==='false' && <fieldset disabled={busy||!selectedRows.length} className={`${card} space-y-3`}><p className="text-xs text-slate-400">{selectedRows.length} selected. Grouping never publishes the original text.</p><label className="block text-xs">Roadmap group<select aria-label="Roadmap group" value={target} onChange={event=>setTarget(event.target.value)} className={`mt-1 block w-full ${control}`}><option value="">Choose a saved roadmap draft…</option><option value="unlink">Unlink selected suggestions</option>{roadmap.filter(item=>!item.archived_at).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="flex flex-wrap gap-2"><button type="button" disabled={!target} className={control} onClick={()=>void review('group')}>Group selected</button><button type="button" className={control} onClick={()=>void review('review')}>Mark selected reviewed</button></div></fieldset>}
        {!loading && !visible.length && <p className="text-sm text-slate-400">No suggestions match this view.</p>}
        {visible.map(item=><article key={item.id} className={card} data-no-translate><div className="flex items-start gap-3">{!item.archived_at && <input type="checkbox" disabled={busy||(!checked.includes(item.id)&&checked.length>=100)} aria-label={`Select suggestion: ${item.title}`} checked={checked.includes(item.id)} onChange={event=>setChecked(ids=>event.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))} className="mt-1 h-4 w-4 shrink-0" />}<div className="min-w-0 flex-1"><h4 className="break-words font-bold">{item.title}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{item.details}</p><p className="mt-3 text-xs text-slate-400">{item.review_state==='new'?'New':'Reviewed'} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-1 break-words text-xs text-slate-400">Group: {roadmap.find(road=>road.id===item.roadmap_id)?.title||'Ungrouped'}</p><button type="button" disabled={busy} className={`mt-3 ${control}`} onClick={()=>void review(item.archived_at?'restore':'archive',[item])}>{item.archived_at?'Restore suggestion':'Archive suggestion'}</button></div></div></article>)}
        {suggestions.length===200 && <p className="text-xs text-slate-400">Showing the 200 most recent matches. Use review or group filters to narrow the list.</p>}
      </section>
      <section className="min-w-0 space-y-3" aria-labelledby="roadmap-editor-heading"><div className="flex items-center justify-between gap-3"><h3 id="roadmap-editor-heading" className="font-bold">Roadmap drafts</h3><button type="button" disabled={busy} className={control} onClick={()=>{setSelected('new');setError('');setNotice('');}}>{drafts.new?'Resume new draft':'New roadmap draft'}</button></div>
        <label className="block text-xs">Choose a roadmap item<select aria-label="Choose roadmap draft" value={selected} disabled={busy} onChange={event=>setSelected(event.target.value)} className={`mt-1 block w-full ${control}`}><option value="">Select a draft…</option>{selected==='new' && <option value="new">New draft</option>}{roadmap.map(item=><option key={item.id} value={item.id}>{item.title} · {item.archived_at?'Archived':item.published?'Published':'Draft'}</option>)}</select></label>
        {selected && (selected==='new'||saved) && <div className={`${card} space-y-4`}>
          {stale && <div role="alert" className="space-y-2 rounded-xl bg-amber-950 p-3 text-sm text-amber-100"><p>Your draft uses an older revision. Refreshing keeps it safe; compare it with the latest saved version before saving.</p><p data-no-translate className="break-words">Latest saved: {saved.title} — {saved.summary}</p><button type="button" disabled={busy} className={control} onClick={()=>{if(window.confirm('Use the latest revision for your draft? Saving will replace the latest saved text with your draft.'))edit({revision:saved.revision});}}>Use latest revision for my draft</button></div>}
          <form onSubmit={save}><fieldset disabled={busy||!!saved?.archived_at} className="space-y-3"><label className="block text-sm">Roadmap title<input required minLength={3} maxLength={160} value={draft.title} onChange={event=>edit({title:event.target.value})} className={`mt-1 block w-full ${control}`} /></label><label className="block text-sm">Roadmap summary<textarea required minLength={10} maxLength={3000} rows={5} value={draft.summary} onChange={event=>edit({summary:event.target.value})} className={`mt-1 block w-full ${control}`} /></label><label className="block text-sm">Roadmap status<select value={draft.status} onChange={event=>edit({status:event.target.value as RoadmapStatus})} className={`mt-1 block w-full ${control}`}>{roadmapStatuses.map(status=><option key={status} value={status}>{roadmapStatusLabels[status]}</option>)}</select></label><p className="text-xs text-slate-400">Write a general improvement summary. Leave out submitter names, contact details and identifying circumstances. No suggestion text is copied automatically.</p><button type="submit" disabled={stale} className={control}>{busy?'Saving…':'Save roadmap draft'}</button></fieldset></form>
          {saved && <><div className="space-y-2 rounded-xl bg-slate-950 p-3" data-no-translate><p className="text-xs font-bold text-violet-300">Saved publication preview · {roadmapStatusLabels[saved.status]}</p><h4 className="break-words font-bold">{saved.title}</h4><p className="whitespace-pre-wrap break-words text-sm text-slate-300">{saved.summary}</p></div>
            {saved.published && <details className="rounded-xl border border-violet-500/30 p-3"><summary className="cursor-pointer text-sm">Currently public · {roadmapStatusLabels[saved.published_status!]}</summary><div data-no-translate><p className="mt-2 break-words font-bold">{saved.published_title}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{saved.published_summary}</p></div></details>}
            {dirty && <p className="text-xs text-amber-200">Save your draft first. Publishing uses the saved preview above.</p>}
            {!saved.archived_at && <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy||dirty} checked={publicationReviewed} onChange={event=>setPublicationReviewed(event.target.checked)} className="mt-1" />I reviewed the saved summary for identifying information and want it public.</label>}
            <div className="flex flex-wrap gap-2">{saved.archived_at?<button type="button" disabled={busy} className={control} onClick={()=>void changeRoadmap('restore')}>Restore roadmap draft</button>:<><button type="button" disabled={busy||dirty||!publicationReviewed} className={control} onClick={()=>void changeRoadmap('publish')}>Publish reviewed summary</button>{saved.published && <button type="button" disabled={busy} className={control} onClick={()=>void changeRoadmap('unpublish')}>Unpublish</button>}<button type="button" disabled={busy} className={control} onClick={()=>void changeRoadmap('archive')}>Archive roadmap item</button></>}</div>
            {!!events.length && <details><summary className="cursor-pointer text-sm">Roadmap activity</summary><ol className="mt-2 space-y-1 text-xs text-slate-400">{events.map(event=><li key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.action} · revision {event.revision} · {event.actor_id?`Account ${event.actor_id.slice(0,8)}`:'Former account'}</li>)}</ol></details>}
          </>}
        </div>}
        {!selected && <p className="text-sm text-slate-400">Create or select a roadmap draft. Group suggestions under it before or after publication.</p>}
      </section>
    </div>
  </section>;
}
