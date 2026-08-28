import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileText,
  HeartHandshake,
  KeyRound,
  Lock,
  Notebook,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Users
} from 'lucide-react';
import type { ActiveTab } from './Navbar';

interface HelpArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  steps: string[];
  note?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const helpArticles: HelpArticle[] = [
  { id: 'start', category: 'Getting started', title: 'Finding your way around Q', summary: 'Use the colourful navigation bar to move between the main areas without losing your current work.', steps: ['Q Intelligence opens your private AI companion.', 'Life Guides contains practical saved guidance and action plans.', 'Peer Knowledge contains community-informed lived-experience content.', 'Private Journal combines journal entries and mood check-ins.', 'Profile contains account, privacy, backup, security, and subscription controls.', 'Help returns you to this knowledge base.'], icon: Smartphone },
  { id: 'ai-modes', category: 'Q Intelligence', title: 'Choose local or hosted AI', summary: 'The processing banner always shows which mode is selected before you send a message.', steps: ['Choose Private local AI to generate responses in your browser with WebLLM and Llama.', 'The first local use downloads and caches a model of roughly 900 MB.', 'Choose Hosted AI only when you want the masked prompt and disclosed context sent through Q to OpenAI.', 'Hosted AI requires sign-in and has usage limits.', 'You can change modes from the provider menu above the conversation.'], note: 'Crisis-language checks happen before either AI processing route. AI is not professional or emergency advice.', icon: Bot },
  { id: 'ai-chat', category: 'Q Intelligence', title: 'Ask Q and save useful answers', summary: 'Type a question, use a suggested prompt, or save an AI response into your Life Guides.', steps: ['Enter a question in the composer at the bottom of Q Intelligence.', 'Review the processing disclosure shown above the conversation.', 'Select Send and wait for the Q logo to finish pulsing.', 'Use Save to Vault beneath a useful response to create an offline Life Guide.', 'Use the reset control to clear the active chat history on this device.'], icon: Sparkles },
  { id: 'memory', category: 'Q Intelligence', title: 'Control Q Context Memory', summary: 'Memory is optional and stores only user-authored context when explicitly enabled.', steps: ['Open Memory Engine from Q Intelligence.', 'Review or update your preferred name, pronouns, and region.', 'Enable Opt-In AI Context Memory only if you want Q to recall user-authored context.', 'Save the preferences.', 'Review and remove saved memories from the Profile privacy controls.'], note: 'Q does not automatically save assistant replies as facts about you.', icon: Shield },
  { id: 'guides', category: 'Life Guides', title: 'Use Life Guides and action plans', summary: 'Guides turn useful information into practical steps you can revisit.', steps: ['Open Life Guides from navigation.', 'Browse or search by topic.', 'Open a guide to review its summary and steps.', 'Tick steps as you complete them.', 'Save selected AI answers to the Vault to create personal guides.'], icon: BookOpen },
  { id: 'community', category: 'Peer Knowledge', title: 'Browse peer knowledge safely', summary: 'Read community-informed experiences while remembering that individual experiences are not universal advice.', steps: ['Open Peer Knowledge.', 'Browse the available lived-experience topics.', 'Use stories as perspective rather than verified professional advice.', 'For medical, legal, safeguarding, or crisis decisions, use verified local professional support.'], icon: Users },
  { id: 'journal', category: 'Private Journal', title: 'Write and manage journal entries', summary: 'Journal entries stay account-scoped when synchronized and can also support private reflection.', steps: ['Open Private Journal.', 'Create a new entry and add a title and reflection.', 'Use search to find previous entries.', 'Edit or delete entries you no longer need.', 'Use the PDF export option when you need a personal offline copy.'], note: 'Only export to a device and location you consider safe.', icon: Notebook },
  { id: 'mood', category: 'Private Journal', title: 'Record a mood check-in', summary: 'Mood check-ins help you notice patterns without judging how you feel.', steps: ['Open Private Journal and locate the mood area.', 'Choose the rating or label that best fits the moment.', 'Add optional notes or tags.', 'Review mood history and patterns later.', 'Use Q or professional support when a pattern concerns you.'], icon: HeartHandshake },
  { id: 'profile', category: 'Account', title: 'Manage your profile and account', summary: 'Profile centralises account details and personal preferences.', steps: ['Open Profile from navigation.', 'Review your name, pronouns, region, and privacy preferences.', 'Save changes before leaving the page.', 'Use the account actions for backup, security, subscription, or sign out.'], icon: FileText },
  { id: 'security', category: 'Privacy & safety', title: 'Set a privacy lock', summary: 'Protect the whole app or only the Journal with a PIN or supported lock method.', steps: ['Open Profile, then Security settings.', 'Choose the lock type and scope.', 'Set an auto-lock delay appropriate for your situation.', 'Save and test the lock before relying on it.', 'Keep recovery limitations in mind if you forget a PIN.'], icon: Lock },
  { id: 'notes', category: 'Privacy & safety', title: 'Use discreet Notes mode', summary: 'Notes mode immediately replaces Q with a functional, neutral QuickNotes interface.', steps: ['Select Disguise Mode from the lower corner, or press Alt+M.', 'Use QuickNotes normally: add, select, and edit notes.', 'Select the small Back control at the bottom of the notes sidebar to return to Q.', 'If a privacy PIN is configured, enter it to return.', 'Q returns to the same tab and in-memory state you left.'], note: 'Notes mode does not erase earlier browser history, network records, downloads, or browser-managed caches.', icon: FileText },
  { id: 'backup', category: 'Privacy & safety', title: 'Back up or restore local Q data', summary: 'Use encrypted or safely stored backups when moving devices or protecting important local information.', steps: ['Open Profile and choose Backup.', 'Review exactly which data will be included.', 'Export only to a location you trust.', 'Use Import to restore a compatible Q backup.', 'Check the restored content before removing the original copy.'], icon: KeyRound },
  { id: 'subscription', category: 'Subscription', title: 'Subscribe or manage billing', summary: 'Q uses PayPal for recurring monthly and yearly subscriptions.', steps: ['Select Subscribe in the app header or Profile.', 'Choose an available monthly or yearly plan.', 'Review the complete PayPal schedule, including any introductory cycles.', 'Approve the subscription in PayPal.', 'Return to Q and allow the subscription status to verify.', 'Use PayPal and Q account controls to review or cancel billing.'], note: 'Never give Q staff card details outside a PayPal-hosted payment interface.', icon: CreditCard },
  { id: 'privacy', category: 'Privacy & safety', title: 'Understand where data is stored', summary: 'Different Q features use browser storage, account-scoped Supabase storage, or an explicitly selected hosted processor.', steps: ['Local AI generation remains in the browser, although model files must be downloaded.', 'Chat history and some preferences may be stored on the device.', 'Opted-in memories and synchronized user content are protected by account-scoped row-level security.', 'Hosted AI sends the disclosed masked context to Q and OpenAI.', 'Read Privacy, AI Disclaimer, Processor Register, and Third-Party Notices from the legal footer.'], icon: Shield },
  { id: 'accessibility', category: 'Accessibility', title: 'Use Q with accessibility settings', summary: 'Q supports keyboard navigation, visible focus, responsive text, reduced motion, and semantic controls.', steps: ['Use Tab and Shift+Tab to move through controls.', 'Press Enter or Space to activate the focused control.', 'Enable reduced motion in your device settings to stop animated spectrum effects.', 'Use browser zoom or device text scaling when needed.', 'Use the theme control to switch appearance.'], icon: CircleHelp },
  { id: 'troubleshooting-local', category: 'Troubleshooting', title: 'Local AI is unavailable', summary: 'Local Q Intelligence requires a WebGPU-capable browser and sufficient device storage.', steps: ['Check the processing banner for WebGPU support information.', 'Update the browser and device graphics drivers where appropriate.', 'Ensure enough storage is available for the model download.', 'Keep the page open during the first model load.', 'Use Hosted AI if local mode is unsupported and you accept the disclosed processing.'], icon: Bot },
  { id: 'troubleshooting-account', category: 'Troubleshooting', title: 'Sign-in, verification, or reset problems', summary: 'Most account issues can be resolved by checking the correct email, redirect, and current session.', steps: ['Confirm you are using the email associated with Q.', 'Check spam or junk folders for verification and reset messages.', 'Open the newest link; older links may have expired.', 'Return to https://q-ai.online/app after verification.', 'Use the password-reset request option if the normal reset flow remains unavailable.'], icon: KeyRound },
  { id: 'crisis', category: 'Immediate support', title: 'Get immediate human support', summary: 'Q can show country-aware crisis resources, but it is not an emergency service.', steps: ['Select 24/7 Helpline in the app header.', 'Choose or verify your country.', 'Use the displayed official phone, text, or web resource.', 'If there is immediate danger, contact local emergency services now.', 'Move to a safer device or place if accessing support could put you at risk.'], icon: HeartHandshake }
];

const categories = ['All', ...Array.from(new Set(helpArticles.map(article => article.category)))];

interface Props {
  onNavigate: (tab: ActiveTab) => void;
  onOpenCrisis: () => void;
  onOpenSubscription: () => void;
}

export const HelpView: React.FC<Props> = ({ onNavigate, onOpenCrisis, onOpenSubscription }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleArticles = useMemo(() => helpArticles.filter(article => {
    const categoryMatches = category === 'All' || article.category === category;
    const queryMatches = !normalizedQuery || [article.title, article.summary, article.category, ...article.steps].join(' ').toLowerCase().includes(normalizedQuery);
    return categoryMatches && queryMatches;
  }), [category, normalizedQuery]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-6">
      <section className="pride-card pride-edge overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pride-spectrum absolute inset-x-0 top-0 h-1" />
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 p-3 text-white shadow-lg shadow-violet-500/20"><CircleHelp className="h-7 w-7" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Q Knowledge Base</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">How can we help?</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Search practical, privacy-aware instructions for using every part of Q. This guide is bundled with the app so its core content remains available without relying on an external help centre.</p>
          </div>
        </div>
        <label className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 shadow-sm ring-4 ring-violet-100/60">
          <Search className="h-5 w-5 shrink-0 text-violet-600" />
          <span className="sr-only">Search help</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Q help…" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
        </label>
      </section>

      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`min-h-10 shrink-0 rounded-full px-3.5 text-xs font-bold transition active:scale-95 ${category === item ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'}`}>{item}</button>)}
      </div>

      <section className="grid grid-cols-2 gap-2 rounded-2xl bg-white/80 p-3 sm:grid-cols-4">
        <button onClick={() => onNavigate('chat')} className="min-h-20 rounded-2xl bg-violet-50 p-3 text-left text-xs font-bold text-violet-800 transition hover:bg-violet-100 active:scale-[.98]"><Bot className="mb-2 h-5 w-5" />Open Q Intelligence</button>
        <button onClick={() => onNavigate('journal')} className="min-h-20 rounded-2xl bg-indigo-50 p-3 text-left text-xs font-bold text-indigo-800 transition hover:bg-indigo-100 active:scale-[.98]"><Notebook className="mb-2 h-5 w-5" />Open Journal</button>
        <button onClick={onOpenSubscription} className="min-h-20 rounded-2xl bg-rose-50 p-3 text-left text-xs font-bold text-rose-800 transition hover:bg-rose-100 active:scale-[.98]"><CreditCard className="mb-2 h-5 w-5" />Subscription help</button>
        <button onClick={onOpenCrisis} className="min-h-20 rounded-2xl bg-red-50 p-3 text-left text-xs font-bold text-red-800 transition hover:bg-red-100 active:scale-[.98]"><HeartHandshake className="mb-2 h-5 w-5" />24/7 support</button>
      </section>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1"><h2 className="text-sm font-black text-slate-900">{visibleArticles.length} help {visibleArticles.length === 1 ? 'article' : 'articles'}</h2><span className="text-[11px] text-slate-500">Select an article to expand</span></div>
        {visibleArticles.map(article => {
          const Icon = article.icon;
          return <details key={article.id} className="group pride-edge rounded-2xl border border-violet-100 bg-white/95 shadow-sm open:shadow-lg open:shadow-violet-950/5">
            <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 rounded-2xl p-4 marker:hidden">
              <span className="rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 p-2.5 text-violet-700"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-violet-500">{article.category}</span><span className="mt-0.5 block text-sm font-black text-slate-900">{article.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{article.summary}</span></span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-90 group-open:text-violet-600" />
            </summary>
            <div className="border-t border-violet-100 px-4 pb-5 pt-4 sm:px-6">
              <ol className="space-y-3">{article.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-black text-violet-700">{index + 1}</span><span>{step}</span></li>)}</ol>
              {article.note && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><strong>Important:</strong> {article.note}</div>}
            </div>
          </details>;
        })}
        {visibleArticles.length === 0 && <div className="rounded-2xl border border-dashed border-violet-200 bg-white/70 p-8 text-center"><Search className="mx-auto h-7 w-7 text-violet-300" /><p className="mt-3 font-bold text-slate-700">No help articles matched</p><button onClick={() => { setQuery(''); setCategory('All'); }} className="mt-3 text-xs font-bold text-violet-700 underline">Clear search and filters</button></div>}
      </div>
    </div>
  );
};
