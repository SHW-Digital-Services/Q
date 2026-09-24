import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, Circle, ClipboardList, Compass, FileText, Flag, ListChecks, Map, Menu, PenLine, ShieldCheck } from 'lucide-react';
import { PremiumGate, usePremium } from '../contexts/PremiumContext';
import { premiumRequest } from '../services/premium';
import { ProgrammeActivity, ProgrammeActivityConfig } from './ProgrammeActivity';

type ProgrammeSession = {
  title: string;
  body: string;
  prompt: string;
  action: string;
  activityType?: string;
  activity?: ProgrammeActivityConfig;
};
type Programme = { id: string; title: string; summary: string; sessions: ProgrammeSession[] };
export type ProgrammeProgress = { id: string; completed: number[]; notes: Record<string, string> };
type PageSection = 'overview' | 'curriculum' | 'workspace' | 'notes';

const courseMenu = [
  { id: 'overview' as const, label: 'Overview', icon: Map },
  { id: 'curriculum' as const, label: 'Curriculum', icon: ListChecks },
  { id: 'workspace' as const, label: 'Activity', icon: PenLine },
  { id: 'notes' as const, label: 'Support notes', icon: ShieldCheck }
];

function readProgress(key: string): ProgrammeProgress[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function GuidedProgrammes({ onCourseOpenChange }: { onCourseOpenChange?: (open: boolean) => void }) {
  const { premium, userId } = usePremium();
  const [items, setItems] = useState<Programme[]>([]);
  const [error, setError] = useState('');
  const key = `q_programmes_v1:${userId}`;
  const [progress, setProgress] = useState<ProgrammeProgress[]>(() => readProgress(key));
  const [selected, setSelected] = useState('');
  const [step, setStep] = useState(0);
  const [viewAll, setViewAll] = useState(false);
  const [pageSection, setPageSection] = useState<PageSection>('overview');

  useEffect(() => {
    const refresh = () => {
      setProgress(readProgress(key));
    };
    window.addEventListener('q-cloud-applied', refresh);
    return () => window.removeEventListener('q-cloud-applied', refresh);
  }, [key]);

  useEffect(() => {
    let active = true;
    if (premium) {
      premiumRequest('programmes', 'GET', undefined, userId)
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((event) => {
          if (active) setError(event.message);
        });
    }
    return () => {
      active = false;
    };
  }, [premium, userId]);

  useEffect(() => {
    onCourseOpenChange?.(!!selected);
    return () => onCourseOpenChange?.(false);
  }, [onCourseOpenChange, selected]);

  const update = (value: ProgrammeProgress) => {
    const next = [...progress.filter((item) => item.id !== value.id), value];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setProgress(next);
      setError('');
      window.dispatchEvent(new CustomEvent('q-local-change', { detail: { key } }));
    } catch {
      setError('Unable to save progress on this device. Free some storage and try again.');
    }
  };

  const programme = items.find((item) => item.id === selected);
  const saved = progress.find((item) => item.id === selected) || { id: selected, completed: [], notes: {} };
  const visibleItems = viewAll ? items : items.slice(0, 4);
  const completedSessions = useMemo(() => new Set(saved.completed), [saved.completed]);
  const progressCount = programme ? completedSessions.size : 0;
  const progressPct = programme?.sessions.length ? Math.round((progressCount / programme.sessions.length) * 100) : 0;
  const currentSession = programme?.sessions[step];

  return (
    <PremiumGate title="Guided programmes" description="Course-style guided programmes with structured steps, varied activities and practical completion actions. Pause or revisit whenever you need.">
      {error ? <p role="alert" className="text-rose-700 dark:text-rose-200">{error}</p> : null}
      {!items.length && !error ? <p role="status" className="text-slate-700 dark:text-slate-200">Loading programmes...</p> : null}
      {!programme ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{items.length} guided programmes available</p>
            {items.length > 4 ? (
              <button type="button" onClick={() => setViewAll(!viewAll)} className="rounded-xl border border-violet-200 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-50 dark:border-violet-500/50 dark:text-violet-100 dark:hover:bg-violet-500/10">
                {viewAll ? 'Show featured' : 'View all programmes'}
              </button>
            ) : null}
          </div>
          <div className={viewAll ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'flex snap-x gap-3 overflow-x-auto pb-2'}>
            {visibleItems.map((item) => {
              const itemProgress = progress.find((entry) => entry.id === item.id)?.completed.length || 0;
              const pct = item.sessions.length ? Math.round((itemProgress / item.sessions.length) * 100) : 0;
              return (
                <button key={item.id} onClick={() => { setSelected(item.id); setStep(0); setPageSection('overview'); }} className={`${viewAll ? '' : 'w-72 shrink-0 snap-start'} rounded-xl border border-violet-200 bg-white p-4 text-left text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-50 hover:shadow-md dark:border-violet-500/60 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-800 dark:bg-violet-500/15 dark:text-violet-100"><BookOpen className="h-3.5 w-3.5" /> Course</span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{item.sessions.length} steps</span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white">{item.title}</h3>
                  <p className="my-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{item.summary}</p>
                  <div className="mt-3 space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-violet-700 dark:bg-violet-400" style={{ width: `${pct}%` }} /></div>
                    <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">{itemProgress} of {item.sessions.length} steps complete</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4 text-slate-950 dark:text-slate-100">
          <button className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 underline dark:text-violet-200" onClick={() => setSelected('')}><ArrowLeft className="h-4 w-4" /> All programmes</button>
          <div className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/70 dark:border-violet-500/50 dark:bg-slate-900">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-800 shadow-sm dark:bg-violet-500/15 dark:text-violet-100"><Compass className="h-3.5 w-3.5" /> Guided course</span>
                  <h3 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{programme.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{programme.summary}</p>
                </div>
                <div className="min-w-44 rounded-xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Course progress</p>
                  <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{progressPct}%</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} /></div>
                  <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{progressCount} of {programme.sessions.length} steps complete</p>
                </div>
              </div>
            </div>
            <nav aria-label={`${programme.title} course menu`} className="flex gap-2 overflow-x-auto border-t border-violet-200 bg-white/70 p-3 dark:border-violet-500/30 dark:bg-slate-950/70">
              {courseMenu.map((item) => {
                const Icon = item.icon;
                const active = pageSection === item.id;
                return <button key={item.id} type="button" aria-pressed={active} onClick={() => setPageSection(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${active ? 'border-violet-700 bg-violet-700 text-white dark:border-violet-400 dark:bg-violet-500' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'}`}><Icon className="h-4 w-4" /> {item.label}</button>;
              })}
            </nav>
          </div>
          <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400"><Menu className="h-4 w-4" /> Course steps</div>
              <div className="space-y-2">
                {programme.sessions.map((session, index) => {
                  const active = index === step;
                  const complete = completedSessions.has(index);
                  return (
                    <button key={session.title} aria-pressed={active} onClick={() => { setStep(index); setPageSection('workspace'); }} className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition ${active ? 'border-violet-700 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-500/15 dark:text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800'}`}>
                      {complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                      <span>
                        <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Step {index + 1}{session.activityType ? ` · ${session.activityType}` : ''}</span>
                        <span className="block text-sm font-bold">{session.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="space-y-4">
              {pageSection === 'overview' ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"><Flag className="h-5 w-5 text-violet-700 dark:text-violet-300" /> Course overview</div>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">Work through the steps in any order. Each step gives you a short reading, a distinct activity and one practical next step you can complete, adapt or deliberately postpone.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><BookOpen className="h-5 w-5 text-violet-700 dark:text-violet-300" /><p className="mt-2 text-xs font-bold text-slate-950 dark:text-white">{programme.sessions.length} guided steps</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><ClipboardList className="h-5 w-5 text-violet-700 dark:text-violet-300" /><p className="mt-2 text-xs font-bold text-slate-950 dark:text-white">Different activity each step</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><FileText className="h-5 w-5 text-violet-700 dark:text-violet-300" /><p className="mt-2 text-xs font-bold text-slate-950 dark:text-white">Saved private progress</p></div>
                  </div>
                </section>
              ) : null}
              {pageSection === 'curriculum' ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"><ListChecks className="h-5 w-5 text-violet-700 dark:text-violet-300" /> Course curriculum</div>
                  <div className="mt-4 space-y-3">
                    {programme.sessions.map((session, index) => (
                      <button key={session.title} type="button" onClick={() => { setStep(index); setPageSection('workspace'); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Step {index + 1}{session.activityType ? ` · ${session.activityType}` : ''}</p>
                            <h4 className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{session.title}</h4>
                            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{session.action}</p>
                          </div>
                          {completedSessions.has(index) ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <Circle className="h-5 w-5 shrink-0 text-slate-400" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {pageSection === 'workspace' && currentSession ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-black uppercase tracking-wide text-violet-800 dark:text-violet-200">Step {step + 1}{currentSession.activityType ? ` · ${currentSession.activityType}` : ''}</p>
                  <h4 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{currentSession.title}</h4>
                  <p className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">{currentSession.body}</p>
                  <ProgrammeActivity
                    activity={currentSession.activity}
                    prompt={currentSession.prompt}
                    value={saved.notes[step] || ''}
                    onChange={(value) => update({ ...saved, notes: { ...saved.notes, [step]: value } })}
                  />
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"><strong>Your next step: </strong>{currentSession.action}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => update({ ...saved, completed: completedSessions.has(step) ? saved.completed.filter((session) => session !== step) : [...saved.completed, step] })} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-600">
                      {completedSessions.has(step) ? <Circle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {completedSessions.has(step) ? 'Mark incomplete' : 'Complete step'}
                    </button>
                    {step < programme.sessions.length - 1 ? <button type="button" onClick={() => setStep(step + 1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">Next step</button> : null}
                  </div>
                  {progressCount === programme.sessions.length ? <p role="status" className="mt-3 font-semibold text-emerald-700 dark:text-emerald-200">Programme complete. You can revisit your activities any time.</p> : null}
                </section>
              ) : null}
              {pageSection === 'notes' ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"><ShieldCheck className="h-5 w-5 text-violet-700 dark:text-violet-300" /> Support notes</div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    <li>Activity answers stay on this device unless you enable programme continuity in Profile.</li>
                    <li>You can pause, repeat sessions or choose to wait before taking an action.</li>
                    <li>These exercises are self-guided wellbeing tools, not therapy or crisis support.</li>
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PremiumGate>
  );
}
