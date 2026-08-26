import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles, HeartHandshake, Mail, UserRound, Settings } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { QLogo } from './QLogo';
import { LegalFooter } from './LegalFooter';
import { joinWaitlist } from '../services/waitlist';
import { AdminAccessModal } from './AdminAccessModal';
import { AdminPanel } from './AdminPanel';

// 1 November is outside British Summer Time, so 09:00 UK time is 09:00 UTC.
export const Q_LAUNCH_DATE = new Date('2026-11-01T09:00:00Z');

function isLaunchLandingEnabled() {
  return Date.now() >= Q_LAUNCH_DATE.getTime();
}

const LaunchLandingPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 text-white overflow-hidden">
      <div className="absolute top-0 left-1/3 w-[32rem] h-[32rem] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-indigo-500/20 rounded-full blur-[130px] pointer-events-none" />

      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <QLogo size="sm" />
        </div>
        <span className="text-xs font-semibold text-purple-200/80">Now live</span>
      </nav>

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-purple-100 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            Q is ready for you
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-[1.02]">
            A private launchpad for support, reflection, and steady growth.
          </h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-purple-100/80">
            Step into Q to explore affirming guidance, thoughtful support, and a calm space to process what matters most.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <a
              href="/?view=app"
              className="inline-flex justify-center w-full sm:w-auto items-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 px-5 py-4 text-base font-bold text-white shadow-2xl shadow-purple-600/40 transition hover:shadow-purple-700/40 hover:scale-[1.01]"
            >
              Open Q <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#features"
              className="inline-flex justify-center w-full sm:w-auto items-center rounded-full border border-white/20 bg-white/10 px-5 py-4 text-sm font-semibold text-purple-50 transition hover:bg-white/15"
            >
              See what’s inside
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-purple-500/20 blur-2xl" />
          <div className="relative rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 pb-5 border-b border-white/10">
              <QLogo size="md" />
              <div>
                <div className="font-bold">Your space, your pace.</div>
                <div className="text-xs text-purple-200/70">Support that respects your context.</div>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {[
                { icon: ShieldCheck, title: 'Trusted privacy', text: 'A calm, protected place to think and reflect.' },
                { icon: HeartHandshake, title: 'Affirming guidance', text: 'Support shaped around real lived experience.' },
                { icon: LockKeyhole, title: 'Private journaling', text: 'Capture your thoughts safely and on your own terms.' }
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-2xl bg-black/10 border border-white/10">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-200"><Icon className="w-4 h-4" /></div>
                  <div><div className="text-sm font-bold">{title}</div><div className="text-xs text-purple-100/65 mt-0.5">{text}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Private conversations', text: 'Talk through what matters in a space designed to feel calm and secure.' },
            { title: 'Life-guided support', text: 'Access practical tools and affirming resources when you need direction.' },
            { title: 'Reflect with care', text: 'Use journaling and check-ins to make sense of your day and your feelings.' }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-purple-100/75">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <LegalFooter />
    </main>
  );
};

export const WaitlistLandingPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'joined' | 'already_joined' | 'error'>('idle');

  const handleWaitlistSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('submitting');
    try {
      const result = await joinWaitlist(name, email);
      setStatus(result);
      if (result === 'joined') {
        setName('');
        setEmail('');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 text-white overflow-hidden">
      <div className="absolute top-0 left-1/3 w-[32rem] h-[32rem] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-indigo-500/20 rounded-full blur-[130px] pointer-events-none" />

      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <QLogo size="sm" />
        </div>
        <span className="text-xs font-semibold text-purple-200/80">A safer life companion</span>
      </nav>

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-28 grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 items-start">
        <div>
          <div className="max-w-full sm:max-w-lg mx-auto">
            <CountdownTimer targetDate={Q_LAUNCH_DATE} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-purple-100 mt-8 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            LGBTQ+ Life OS
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-[1.02]">
            A private place to think, grow, and feel supported.
          </h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-purple-100/80">
            Q brings thoughtful AI guidance, affirming life resources, peer wisdom, and private reflection tools together in one trust-first space.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
            <span className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15">Private by design</span>
            <span className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15">Affirming by default</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-purple-500/20 blur-2xl" />
          <div className="relative rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 pb-5 border-b border-white/10">
              <QLogo size="md" />
              <div>
                <div className="font-bold">Your space, your pace.</div>
                <div className="text-xs text-purple-200/70">A companion that respects your context.</div>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {[
                { icon: ShieldCheck, title: 'Trust-first privacy', text: 'Your personal context stays under your control.' },
                { icon: HeartHandshake, title: 'Lived experience matters', text: 'Guidance shaped around LGBTQ+ realities.' },
                { icon: LockKeyhole, title: 'Private reflection', text: 'Journal, check in, and make meaning safely.' }
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-2xl bg-black/10 border border-white/10">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-200"><Icon className="w-4 h-4" /></div>
                  <div><div className="text-sm font-bold">{title}</div><div className="text-xs text-purple-100/65 mt-0.5">{text}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 shadow-2xl">
          <h2 className="text-2xl font-black">Be the first to know</h2>
          <p className="mt-2 text-sm text-purple-100/75">Join the Q Intelligence waitlist for launch updates and early access.</p>
          <form onSubmit={handleWaitlistSubmit} className="mt-5 space-y-3 text-left">
            <label className="relative block">
              <UserRound className="absolute left-3 top-3.5 w-4 h-4 text-purple-200/60" />
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl bg-white/10 border border-white/15 text-white placeholder-purple-100/50 pl-10 pr-3 py-3 text-sm outline-none focus:border-purple-300"
              />
            </label>
            <label className="relative block">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-purple-200/60" />
              <input
                required
                type="email"
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl bg-white/10 border border-white/15 text-white placeholder-purple-100/50 pl-10 pr-3 py-3 text-sm outline-none focus:border-purple-300"
              />
            </label>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-xl bg-white text-purple-950 hover:bg-purple-50 py-3 text-sm font-bold disabled:opacity-60"
            >
              {status === 'submitting' ? 'Joining...' : 'Join the waitlist'}
            </button>
          </form>
          {status === 'joined' && <p className="mt-3 text-xs font-semibold text-emerald-200">You’re on the list. Welcome to Q Intelligence.</p>}
          {status === 'already_joined' && <p className="mt-3 text-xs font-semibold text-purple-100">That email is already on the waitlist.</p>}
          {status === 'error' && <p className="mt-3 text-xs font-semibold text-rose-200">We couldn’t add you right now. Please try again.</p>}
          <p className="mt-4 text-[10px] text-purple-100/50">We’ll only use your details for Q launch updates.</p>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
};

export const LandingPage: React.FC = () => {
  const [launchEnabled, setLaunchEnabled] = useState(() => isLaunchLandingEnabled());
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  useEffect(() => {
    fetch('/api/v1/admin/site-settings/launch')
      .then((response) => response.json())
      .then((data) => { if (data.enabled === true) setLaunchEnabled(true); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (launchEnabled) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= Q_LAUNCH_DATE.getTime()) {
        setLaunchEnabled(true);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [launchEnabled]);

  const handleAdminGranted = () => {
    setAdminPanelOpen(true);
  };

  const handleToggleLaunch = (value: boolean) => {
    const effectiveValue = Date.now() >= Q_LAUNCH_DATE.getTime() || value;
    setLaunchEnabled(effectiveValue);
  };

  return (
    <>
      {launchEnabled ? <LaunchLandingPage /> : <WaitlistLandingPage />}
      <button
        type="button"
        onClick={() => setAdminModalOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-white/15 bg-slate-900/80 p-3 text-white shadow-lg backdrop-blur transition hover:bg-slate-800"
        aria-label="Open admin access"
      >
        <Settings className="h-5 w-5" />
      </button>
      <AdminAccessModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onAdminGranted={handleAdminGranted}
      />
      {adminPanelOpen && (
        <AdminPanel
          enabled={launchEnabled}
          onToggle={handleToggleLaunch}
          onClose={() => setAdminPanelOpen(false)}
        />
      )}
    </>
  );
};
