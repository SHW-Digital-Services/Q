import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileText,
  HeartHandshake,
  KeyRound,
  Lock,
  Notebook,
  Search,
  Send,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Users
} from 'lucide-react';
import type { ActiveTab } from './Navbar';
import { useLanguage } from '../contexts/LanguageContext';
import { HelpVideos } from './HelpVideos';
import SupportRequests from './SupportRequests';
import HelpCentre from './HelpCentre';
import FeedbackPanel from './FeedbackPanel';


interface Props {
  onNavigate?: (tab: ActiveTab) => void;
  onOpenCrisis: () => void;
  onOpenSubscription?: () => void;
}

export const HelpView: React.FC<Props> = ({ onNavigate, onOpenCrisis, onOpenSubscription }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-6">
      <section className="pride-card pride-edge overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pride-spectrum absolute inset-x-0 top-0 h-1" />
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 p-3 text-white shadow-lg shadow-violet-500/20"><CircleHelp className="h-7 w-7" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{t('knowledgeBase')}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{t('howHelp')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{t('helpIntro')}</p>
          </div>
        </div>
        <label className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 shadow-sm ring-4 ring-violet-100/60">
          <Search className="h-5 w-5 shrink-0 text-violet-600" />
          <span className="sr-only">{t('searchHelp')}</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchHelp')} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
        </label>
      </section>

      <HelpVideos query={query} />

      <section className="grid grid-cols-2 gap-2 rounded-2xl bg-white/80 p-3 sm:grid-cols-4">
        {onNavigate && <button onClick={() => onNavigate('chat')} className="min-h-20 rounded-2xl bg-violet-50 p-3 text-left text-xs font-bold text-violet-800 transition hover:bg-violet-100 active:scale-[.98]"><Bot className="mb-2 h-5 w-5" />{t('openAI')}</button>}
        {onNavigate && <button onClick={() => onNavigate('journal')} className="min-h-20 rounded-2xl bg-indigo-50 p-3 text-left text-xs font-bold text-indigo-800 transition hover:bg-indigo-100 active:scale-[.98]"><Notebook className="mb-2 h-5 w-5" />{t('openJournal')}</button>}
        {onOpenSubscription && <button onClick={onOpenSubscription} className="min-h-20 rounded-2xl bg-rose-50 p-3 text-left text-xs font-bold text-rose-800 transition hover:bg-rose-100 active:scale-[.98]"><CreditCard className="mb-2 h-5 w-5" />{t('subscriptionHelp')}</button>}
        <button onClick={onOpenCrisis} className="min-h-20 rounded-2xl bg-red-50 p-3 text-left text-xs font-bold text-red-800 transition hover:bg-red-100 active:scale-[.98]"><HeartHandshake className="mb-2 h-5 w-5" />{t('support247')}</button>
      </section>

      <section className="pride-card pride-edge rounded-3xl p-5 sm:p-7">
        <SupportRequests initialRequestId={new URLSearchParams(window.location.search).get('request') || ''} />
        <p className="mt-4 text-xs text-slate-500">Submitted a question while signed out? <a href="/support" className="text-violet-700 underline">Access it with an email link</a>.</p>
      </section>

      <section className="pride-card pride-edge rounded-3xl p-5 sm:p-7"><FeedbackPanel /></section>

      <HelpCentre query={query} />
    </div>
  );
};
