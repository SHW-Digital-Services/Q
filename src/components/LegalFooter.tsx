import React from 'react';

// Centralized list of all legal documents
const legalLinks = [
  { name: 'Acceptable Use', path: '/legal/acceptable_use_policy' },
  { name: 'Accessibility', path: '/legal/accessibility' },
  { name: 'AI Disclaimer', path: '/legal/ai_disclaimer' },
  { name: 'Cookie Policy', path: '/legal/cookie' },
  { name: 'DPA', path: '/legal/dpa' },
  { name: 'Privacy Policy', path: '/legal/privacy' },
  { name: 'Processor Register', path: '/legal/PROCESSORS' },
  { name: 'Security Policy', path: '/legal/security' },
  { name: 'Terms of Service', path: '/legal/terms' },
  { name: 'Third-Party Notices', path: '/legal/third_party_notices' },
];

export const LegalFooter = () => {
  return <footer className="mt-auto py-10 px-6 text-center text-[10px] text-slate-400 border-t border-slate-900 bg-slate-950">
    <div className="mx-auto mb-8 max-w-4xl rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-left text-[11px] leading-5 text-amber-100/90">
      <h2 className="text-xs font-black uppercase tracking-widest text-amber-100">Important safety and privacy information</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p><strong>Not a clinical service.</strong> Q Intelligence is a self-help and guidance tool, not clinical treatment, a medical device, or a substitute for professional medical advice, diagnosis, psychiatric care, or emergency services. Mood summaries describe only the data you record; they cannot diagnose conditions, explain causes, or represent unrecorded days.</p>
        <p><strong>Crisis support.</strong> Q is not an emergency responder or staffed helpline and does not actively monitor inputs. Crisis-language checks may signpost country-specific resources but cannot guarantee detection. In an emergency, contact local emergency services (999 in the UK) or a dedicated helpline immediately.</p>
        <p><strong>Local AI and network use.</strong> Local AI runs in your browser, but authentication, selected cloud continuity, model downloads, and any hosted AI you choose require network services. Hosted processing sends conversation context to Q and OpenAI after masking and sanitisation; absolute anonymity cannot be guaranteed.</p>
        <p><strong>Discretion and storage.</strong> Notes mode and the app-lock PIN reduce casual on-screen exposure; they do not encrypt device content or erase browser history, downloads, or network records. Cloud continuity backups are not end-to-end encrypted.</p>
      </div>
      <a href="/legal/ai_disclaimer" className="mt-3 inline-block font-bold text-amber-200 underline underline-offset-2 hover:text-white">Read the full AI, medical, crisis and privacy disclaimer</a>
    </div>
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 max-w-4xl mx-auto">
      {legalLinks.map((link) => (
        <a
          key={link.path}
          href={link.path}
          className="hover:text-indigo-400 transition-colors uppercase tracking-widest font-semibold"
        >
          {link.name}
        </a>
      ))}
    </div>

    <div className="mt-6 text-slate-400">
      © {new Date().getFullYear()} Q Life Operating System. All rights reserved.
    </div>
    <div className="mt-2 text-slate-400 font-semibold">Built with Llama</div>
  </footer>;
};
