import React, { useEffect, useState } from 'react';
import { Target, MessageCircle, CalendarDays, Download } from 'lucide-react';
import { PremiumGate, usePremium } from '../contexts/PremiumContext';
import { premiumRequest } from '../services/premium';
import { getDailyMoodLogs, getJournalEntries } from '../services/storage';
import { downloadSnapshot } from '../services/continuity';
import { emptyWorkspace, localDate, readWorkspace, weekDates, workspaceKey, writeWorkspace, type PremiumWorkspace as Workspace } from '../services/premiumWorkspace';
import type { premiumTools } from '../../server/premium-tools';

const field = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const action = 'rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const features = [
  { id: 'goals', title: 'Goal & habit planner', text: 'Choose small goals, plan practice days and track your progress without losing sight of why it matters.', icon: Target },
  { id: 'rehearsals', title: 'Conversation rehearsal', text: 'Practise a boundary, a privacy request or a difficult conversation, then save the words that work for you.', icon: MessageCircle },
  { id: 'reviews', title: 'Weekly reflection & plan', text: 'Look back at your week, recognise what helped and make room for one manageable next step.', icon: CalendarDays }
] as const;

export default function PremiumWorkspace() {
  const { userId, premium } = usePremium();
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [catalog, setCatalog] = useState<typeof premiumTools | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<'goals' | 'rehearsals' | 'reviews'>('goals');
  const [scenarioId, setScenarioId] = useState('boundary');
  const [reviewDate, setReviewDate] = useState(localDate());
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    const load = () => {
      try { setData(readWorkspace(userId)); setBlocked(false); setError(''); setSaved(''); }
      catch { setBlocked(true); setError('Unable to read your saved workspace. Export your data before restoring a backup.'); }
    };
    load();
    const storageChanged = (event: StorageEvent) => { if (event.key === workspaceKey(userId) || event.key === null) load(); };
    window.addEventListener('q-backup-imported', load);
    window.addEventListener('storage', storageChanged);
    return () => { window.removeEventListener('q-backup-imported', load); window.removeEventListener('storage', storageChanged); };
  }, [userId]);

  useEffect(() => {
    let active = true;
    setCatalog(null); setCatalogError('');
    if (premium) void premiumRequest('tools', 'GET', undefined, userId).then(result => { if (active) setCatalog(result); }).catch(e => { if (active) setCatalogError(e.message); });
    return () => { active = false; };
  }, [premium, userId, retry]);

  const save = (next: Workspace) => {
    if (!premium || blocked) return;
    setData(next);
    try { writeWorkspace(userId, next); setSaved('Saved on this device'); setError(''); }
    catch { setSaved(''); setError('Changes are visible here but could not be saved on this device. Export them now before leaving this page.'); }
  };
  const exportData = () => downloadSnapshot(blocked ? { rawWorkspace: localStorage.getItem(workspaceKey(userId)) } : data);
  const dates = weekDates();
  const today = localDate();
  const reviewDates = weekDates(new Date(`${reviewDate}T12:00:00`));
  const weekId = reviewDates[0];
  const review = data.reviews.find(r => r.id === weekId) || { id: weekId, answers: {} };
  const scenario = catalog?.scenarios.find(s => s.id === scenarioId);
  const rehearsal = data.rehearsals.find(r => r.id === scenarioId) || { id: scenarioId, first: '', second: '', takeaway: '' };
  const updateRehearsal = (key: 'first' | 'second' | 'takeaway', value: string) => save({ ...data, rehearsals: [...data.rehearsals.filter(r => r.id !== scenarioId), { ...rehearsal, [key]: value }] });
  const moods = getDailyMoodLogs(userId).filter(m => reviewDates.includes(m.date));
  const journals = getJournalEntries(userId).filter(j => reviewDates.includes(j.date));
  const completed = data.goals.reduce((total, goal) => total + goal.checks.filter(d => reviewDates.includes(d)).length, 0);

  return <div className="mx-auto max-w-5xl space-y-5 p-4 pb-8 sm:p-6 text-slate-900 dark:text-slate-100">
    <header><p className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">Q Premium</p><h1 className="mt-2 text-3xl font-bold">Make room for progress</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Practical tools for your everyday life, at your own pace.</p></header>
    <div className="grid gap-3 md:grid-cols-3">{features.map(f => <button key={f.id} onClick={() => setTab(f.id)} aria-pressed={tab === f.id} className={`rounded-2xl border p-4 text-left ${tab === f.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-950' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'}`}><f.icon className="mb-3 h-6 w-6 text-violet-600 dark:text-violet-300"/><span className="block font-bold">{f.title}</span><span className="mt-2 block text-sm text-slate-600 dark:text-slate-300">{f.text}</span></button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><p>Your private drafts stay in this browser, under your account. These tools do not use AI or sync to other devices.</p><button onClick={exportData} className="flex items-center gap-2 rounded-lg border border-slate-300 p-2"><Download size={15}/>Export workspace</button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    <p role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-300">{saved}</p>
    <PremiumGate title={features.find(f => f.id === tab)!.title} description="Included with your Q Premium membership.">
      {catalogError ? <div role="alert"><p>{catalogError}</p><button className={`${action} mt-3`} onClick={() => setRetry(n => n + 1)}>Retry</button></div> : !catalog ? <p role="status">Loading your tools…</p> : blocked ? <p>Restore a valid account backup to continue. Your existing copy has been preserved.</p> : <>
        {tab === 'goals' && <div className="space-y-5">
          <form onSubmit={e => { e.preventDefault(); if (!data.draft.title.trim() || !data.draft.days.length || data.goals.length >= 1000) return; save({ ...data, goals: [...data.goals, { id: crypto.randomUUID(), title: data.draft.title.trim(), reason: data.draft.reason, days: data.draft.days, checks: [], archived: false }], draft: emptyWorkspace().draft }); }} className="space-y-3">
            <label className="block text-sm font-semibold">A small goal<input required maxLength={120} value={data.draft.title} onChange={e => save({ ...data, draft: { ...data.draft, title: e.target.value } })} className={`${field} mt-1`} placeholder="Take a ten-minute walk"/></label>
            <label className="block text-sm font-semibold">Why it matters to you<input maxLength={500} value={data.draft.reason} onChange={e => save({ ...data, draft: { ...data.draft, reason: e.target.value } })} className={`${field} mt-1`} placeholder="Give myself a break from the screen"/></label>
            <fieldset><legend className="mb-2 text-sm font-semibold">Planned days</legend><div className="flex flex-wrap gap-3">{[1,2,3,4,5,6,0].map(day => <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={data.draft.days.includes(day)} onChange={e => save({ ...data, draft: { ...data.draft, days: e.target.checked ? [...data.draft.days, day] : data.draft.days.filter(d => d !== day) } })}/>{weekdays[day]}</label>)}</div></fieldset>
            <button className={action} disabled={!data.draft.title.trim() || !data.draft.days.length || data.goals.length >= 1000}>Add goal</button>
          </form>
          <p className="text-sm text-slate-600 dark:text-slate-300">This week: {dates[0]} – {dates[6]}. Tick the days you practised. Missing a day does not erase your progress.</p>
          {!data.goals.some(g => !g.archived) && <p>No active goals yet. Choose something small enough for this week.</p>}
          {data.goals.filter(g => showArchive || !g.archived).map(goal => <article key={goal.id} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="font-bold">{goal.title}{goal.archived ? ' (archived)' : ''}</h3><p className="text-sm">{goal.reason}</p><div className="flex flex-wrap gap-3">{dates.map(date => { const day = new Date(`${date}T12:00:00`).getDay(); return <label key={date} className="text-center text-xs"><span className="mb-1 block">{weekdays[day]}{goal.days.includes(day) ? ' •' : ''}</span><input aria-label={`${goal.title} on ${date}`} type="checkbox" checked={goal.checks.includes(date)} disabled={goal.archived || date > today} onChange={e => save({ ...data, goals: data.goals.map(g => g.id === goal.id ? { ...g, checks: e.target.checked ? [...g.checks, date] : g.checks.filter(d => d !== date) } : g) })}/></label>; })}</div><p className="text-xs">{goal.checks.filter(d => dates.includes(d)).length} check-ins this week · {goal.checks.length} total. • Planned day</p><button className="text-sm font-semibold text-violet-700 dark:text-violet-300" onClick={() => save({ ...data, goals: data.goals.map(g => g.id === goal.id ? { ...g, archived: !g.archived } : g) })}>{goal.archived ? 'Restore goal' : 'Archive goal'}</button></article>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchive} onChange={e => setShowArchive(e.target.checked)}/>Show archived goals</label>
        </div>}
        {tab === 'rehearsals' && <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">These are scripted practice scenarios. They do not predict how a real person will respond. Choose a situation that feels safe to practise.</p>
          <label className="block text-sm font-semibold">Choose a conversation<select className={`${field} mt-1`} value={scenarioId} onChange={e => setScenarioId(e.target.value)}>{catalog.scenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          {scenario && <><blockquote className="rounded-xl bg-violet-50 p-4 dark:bg-violet-950"><span className="mb-2 block text-xs font-bold">Practice partner</span>{scenario.opening}</blockquote><label className="block text-sm font-semibold">How would you respond?<textarea className={`${field} mt-1`} rows={3} maxLength={3000} value={rehearsal.first} onChange={e => updateRehearsal('first', e.target.value)}/></label>
            {rehearsal.first.trim() && <><blockquote className="rounded-xl bg-violet-50 p-4 dark:bg-violet-950"><span className="mb-2 block text-xs font-bold">Practise a follow-up</span>{scenario.pushback}</blockquote><label className="block text-sm font-semibold">Keep your message clear<textarea className={`${field} mt-1`} rows={3} maxLength={3000} value={rehearsal.second} onChange={e => updateRehearsal('second', e.target.value)}/></label></>}
            <p className="rounded-xl border border-violet-200 p-3 text-sm dark:border-violet-700">Practice tip: {scenario.hint}</p><label className="block text-sm font-semibold">Words I want to keep<textarea className={`${field} mt-1`} rows={3} maxLength={3000} value={rehearsal.takeaway} onChange={e => updateRehearsal('takeaway', e.target.value)} placeholder="Save a version you would feel comfortable using."/></label></>}
        </div>}
        {tab === 'reviews' && <div className="space-y-4">
          <label className="block text-sm font-semibold">Choose a date in the week you want to review<input type="date" required max={today} value={reviewDate} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setReviewDate(e.target.value); }} className={`${field} mt-1`}/></label>
          <h3 className="font-bold">Week of {weekId}</h3><div className="grid grid-cols-3 gap-2 text-center">{[[moods.length, 'mood check-ins'], [journals.length, 'journal entries'], [completed, 'goal check-ins']].map(([count, label]) => <p key={label} className="rounded-xl bg-violet-50 p-3 text-xs dark:bg-violet-950"><strong className="block text-xl">{count}</strong>{label}</p>)}</div>
          <p className="text-xs text-slate-600 dark:text-slate-300">Counts come from this device. They describe recorded activity, not how well you are doing.</p>
          {catalog.reviewPrompts.map(p => <label key={p.id} className="block text-sm font-semibold">{p.title}<textarea rows={3} maxLength={3000} placeholder={p.placeholder} className={`${field} mt-1`} value={review.answers[p.id] || ''} onChange={e => save({ ...data, reviews: [...data.reviews.filter(r => r.id !== weekId), { ...review, answers: { ...review.answers, [p.id]: e.target.value } }] })}/></label>)}
          <details><summary className="cursor-pointer text-sm font-semibold">Past reflections ({data.reviews.length})</summary><div className="mt-2 flex flex-wrap gap-2">{[...data.reviews].sort((a,b) => b.id.localeCompare(a.id)).map(r => <button key={r.id} className="rounded-lg border p-2 text-sm" onClick={() => setReviewDate(r.id)}>Week of {r.id}</button>)}</div></details>
        </div>}
      </>}
    </PremiumGate>
    {!premium && (data.goals.length > 0 || data.rehearsals.length > 0 || data.reviews.length > 0) && <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Read your saved work</summary><p className="my-2 text-sm">Your work remains available to read and export after Premium ends.</p><div className="max-h-96 space-y-4 overflow-auto whitespace-pre-wrap break-words text-sm">
      {data.goals.map(g => <article key={g.id}><h3 className="font-bold">{g.title}</h3><p>{g.reason}</p><p className="text-xs">{g.checks.length} saved check-ins{g.archived ? ' · Archived' : ''}</p></article>)}
      {data.rehearsals.map(r => <article key={r.id}><h3 className="font-bold">Conversation practice: {r.id === 'boundary' ? 'Setting a boundary' : r.id === 'privacy' ? 'Asking for privacy' : r.id === 'support' ? 'Asking for support' : 'Repairing a misunderstanding'}</h3><p>{r.first}</p><p>{r.second}</p><p>{r.takeaway}</p></article>)}
      {data.reviews.map(r => <article key={r.id}><h3 className="font-bold">Reflection · Week of {r.id}</h3>{Object.entries(r.answers).map(([key,value]) => <p key={key}>{value}</p>)}</article>)}
    </div></details>}
    <p className="text-xs text-slate-500 dark:text-slate-300">Workspace exports and account backups contain private text. Keep them somewhere safe.</p>
  </div>;
}
