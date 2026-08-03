from pathlib import Path
import os


root = Path(__file__).resolve().parent
env_path = root / ".env.local"


def _is_enabled() -> bool:
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("VITE_LAUNCH_LANDING_PAGE_ENABLED="):
                value = line.split("=", 1)[1].strip().lower()
                return value in {"1", "true", "yes", "on"}
    return False


launched = _is_enabled()


def apply_launch_landing_page() -> None:
    target = root / "src" / "components" / "LandingPage.tsx"
    landing_page = """import React from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles, HeartHandshake } from 'lucide-react';
import { QLogo } from './QLogo';
import { LegalFooter } from './LegalFooter';

export const LandingPage: React.FC = () => {
  return (
    <main className=\"min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 text-white overflow-hidden\">
      <div className=\"absolute top-0 left-1/3 w-[32rem] h-[32rem] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none\" />
      <div className=\"absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-indigo-500/20 rounded-full blur-[130px] pointer-events-none\" />

      <nav className=\"relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between\">
        <div className=\"flex items-center gap-3\">
          <QLogo size=\"sm\" />
        </div>
        <span className=\"text-xs font-semibold text-purple-200/80\">Now live</span>
      </nav>

      <section className=\"relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-[1.05fr_.95fr] gap-14 items-center\">
        <div>
          <div className=\"inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-purple-100 mb-6\">
            <Sparkles className=\"w-3.5 h-3.5 text-purple-300\" />
            Q is ready for you
          </div>
          <h1 className=\"text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02]\">
            A private launchpad for support, reflection, and steady growth.
          </h1>
          <p className=\"mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-purple-100/80\">
            Step into Q to explore affirming guidance, thoughtful support, and a calm space to process what matters most.
          </p>
          <div className=\"mt-8 flex flex-wrap gap-3\">
            <a
              href=\"/app\"
              className=\"inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-purple-950 transition hover:bg-purple-50\"
            >
              Open Q <ArrowRight className=\"w-4 h-4\" />
            </a>
            <a
              href=\"#features\"
              className=\"inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-purple-50 transition hover:bg-white/15\"
            >
              See what’s inside
            </a>
          </div>
        </div>

        <div className=\"relative\">
          <div className=\"absolute -inset-4 rounded-[2rem] bg-purple-500/20 blur-2xl\" />
          <div className=\"relative rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 shadow-2xl\">
            <div className=\"flex items-center gap-3 pb-5 border-b border-white/10\">
              <QLogo size=\"md\" />
              <div>
                <div className=\"font-bold\">Your space, your pace.</div>
                <div className=\"text-xs text-purple-200/70\">Support that respects your context.</div>
              </div>
            </div>
            <div className=\"space-y-3 mt-6\">
              {[
                { icon: ShieldCheck, title: 'Trusted privacy', text: 'A calm, protected place to think and reflect.' },
                { icon: HeartHandshake, title: 'Affirming guidance', text: 'Support shaped around real lived experience.' },
                { icon: LockKeyhole, title: 'Private journaling', text: 'Capture your thoughts safely and on your own terms.' }
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className=\"flex items-start gap-3 p-3 rounded-2xl bg-black/10 border border-white/10\">
                  <div className=\"p-2 rounded-xl bg-purple-500/20 text-purple-200\"><Icon className=\"w-4 h-4\" /></div>
                  <div><div className=\"text-sm font-bold\">{title}</div><div className=\"text-xs text-purple-100/65 mt-0.5\">{text}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id=\"features\" className=\"relative z-10 max-w-6xl mx-auto px-6 pb-24\">
        <div className=\"grid gap-4 md:grid-cols-3\">
          {[
            { title: 'Private conversations', text: 'Talk through what matters in a space designed to feel calm and secure.' },
            { title: 'Life-guided support', text: 'Access practical tools and affirming resources when you need direction.' },
            { title: 'Reflect with care', text: 'Use journaling and check-ins to make sense of your day and your feelings.' }
          ].map((item) => (
            <div key={item.title} className=\"rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl\">
              <h2 className=\"text-lg font-semibold\">{item.title}</h2>
              <p className=\"mt-2 text-sm leading-6 text-purple-100/75\">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <LegalFooter />
    </main>
  );
};
"""
    target.write_text(landing_page, encoding='utf-8')
    print('Private launch flag is on. The new landing page has been applied.')


if launched:
    apply_launch_landing_page()
else:
    print('Private launch flag is off. No landing page change was applied.')

