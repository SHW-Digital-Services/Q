import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { feedbackApi } from '../services/feedback';
import { roadmapStatuses, roadmapStatusLabels, type RoadmapItem } from '../shared/feedback';

export default function RoadmapBoard() {
  const [items,setItems]=useState<RoadmapItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    void feedbackApi<RoadmapItem[]>('/roadmap',{public:true,signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setItems(result);}).catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Unable to load the roadmap.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[refresh]);
  return <section aria-labelledby="public-roadmap-heading" className="space-y-4 text-slate-900">
    <div className="flex items-start justify-between gap-3"><div><h2 id="public-roadmap-heading" className="text-xl font-bold">Q product roadmap</h2><p className="mt-1 text-sm text-slate-600">See the improvements we are considering, planning and releasing. Plans can change; a status does not promise a release date.</p></div><button type="button" aria-label="Refresh roadmap" disabled={loading} onClick={()=>setRefresh(value=>value+1)} className="rounded-xl border border-violet-200 bg-white p-3 text-violet-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button></div>
    {loading && <p role="status" className="text-sm text-slate-600">Loading roadmap…</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}
    {!loading && !error && !items.length && <p className="rounded-2xl border border-dashed border-violet-200 bg-white p-5 text-sm text-slate-600">No roadmap items have been published yet. You can still suggest an improvement from Help in Q.</p>}
    {!!items.length && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{roadmapStatuses.map(status=><section key={status} aria-label={roadmapStatusLabels[status]} className="min-w-0 rounded-2xl border border-violet-200 bg-violet-50 p-3">
      <h3 className="mb-3 text-sm font-bold text-violet-900">{roadmapStatusLabels[status]}</h3>
      <div className="space-y-3">{items.filter(item=>item.status===status).map(item=><article id={`roadmap-${item.id}`} key={item.id} className="scroll-mt-8 rounded-xl border border-violet-100 bg-white p-4" data-no-translate><h4 className="break-words font-bold">{item.title}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{item.summary}</p><time className="mt-3 block text-xs text-slate-500" dateTime={item.published_at}>Updated {new Date(item.published_at).toLocaleDateString()}</time></article>)}</div>
      {!items.some(item=>item.status===status) && <p className="text-xs text-slate-500">No items at this stage.</p>}
    </section>)}</div>}
    {items.length===200 && <p className="text-xs text-slate-500">Showing the 200 most recently published updates.</p>}
  </section>;
}
