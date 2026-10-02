import { useCrmDraftState } from '../hooks/useCrmDraftState';
import React, { useMemo } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { emailTemplates, fillEmailTemplate, templatePlaceholders } from '../data/emailTemplates';

export function EmailTemplatesSection({ onUse, canUse }: { onUse: (subject: string, content: string) => void; canUse: boolean }) {
  const [search, setSearch] = useCrmDraftState('search', '');
  const [category, setCategory] = useCrmDraftState('category', 'All');
  const [selectedId, setSelectedId] = useCrmDraftState('selectedId', emailTemplates[0].id);
  const [values, setValues] = useCrmDraftState<Record<string, string>>(`template:${selectedId}:values`, {});
  const selected = emailTemplates.find(t => t.id === selectedId) ?? emailTemplates[0];
  const placeholders = useMemo(() => templatePlaceholders(selected.subject, selected.body), [selected]);
  const subject = fillEmailTemplate(selected.subject, values);
  const body = fillEmailTemplate(selected.body, values);
  const visible = emailTemplates.filter(t => (category === 'All' || t.category === category) && `${t.title} ${t.subject} ${t.body}`.toLowerCase().includes(search.toLowerCase()));
  return <section aria-label="Email templates" className="mt-5">
    <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-purple-300" /><h2 className="text-lg font-bold">Email templates</h2><span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-200">30 templates</span></div>
    <p className="mt-2 text-sm text-slate-400">Welcoming, clear and affirming. Make each message fit the person and check the details before sending. Unsaved template details are temporarily saved in this browser tab, including when you switch templates or refresh.</p>
    <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
      <div><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 p-3"><Search className="h-4 w-4" /><input aria-label="Search templates" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates" className="w-full bg-transparent text-sm outline-none" /></label>
        <select aria-label="Template category" value={category} onChange={e => setCategory(e.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm"><option>All</option>{[...new Set(emailTemplates.map(t => t.category))].map(c => <option key={c}>{c}</option>)}</select>
        <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto">{visible.map(t => <button key={t.id} onClick={() => { setSelectedId(t.id); }} aria-pressed={selectedId === t.id} className={`w-full rounded-xl border p-3 text-left ${selectedId === t.id ? 'border-purple-400/40 bg-purple-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}><span className="block text-[11px] text-purple-300">{t.category}</span><span className="mt-1 block text-sm font-semibold">{t.title}</span></button>)}{!visible.length && <p className="p-3 text-sm text-slate-400">No templates match your search.</p>}</div>
      </div>
      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><h3 className="font-bold">{selected.title}</h3><p className="mt-2 text-xs text-slate-400">Fill in the details, then use the template in the composer. You can edit every word there.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{placeholders.map(key => <label key={key} className="block text-xs text-slate-300"><span className="mb-1 block capitalize">{key.replaceAll('_', ' ')}</span><input value={values[key] || ''} maxLength={1000} onChange={e => setValues({ ...values, [key]: e.target.value })} className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={`{{${key}}}`} /></label>)}</div>
        <div className="mt-5 rounded-xl bg-slate-950 p-4"><p className="break-words text-sm font-semibold">Subject: {subject}</p><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{body}</p></div>
        <button type="button" disabled={!canUse} onClick={() => onUse(subject, body)} className="mt-4 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold hover:bg-purple-500 disabled:opacity-40">Use template</button>
        {!canUse && <p className="mt-2 text-xs text-slate-400">Connect your mailbox to use a template in an email.</p>}
      </div>
    </div>
  </section>;
}
