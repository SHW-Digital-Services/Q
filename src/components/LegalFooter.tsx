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

export const LegalFooter = () => (
  <footer className="mt-auto py-10 px-6 text-center text-[10px] text-slate-400 border-t border-slate-900 bg-slate-950">
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
  </footer>
);
