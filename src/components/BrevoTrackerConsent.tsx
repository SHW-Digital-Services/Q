import { useEffect, useState } from 'react';

const CONSENT_KEY = 'q_brevo_analytics_consent_v1';
const clientKey = import.meta.env.VITE_BREVO_CLIENT_KEY?.trim();

declare global {
  interface Window {
    Brevo?: unknown[] & { push: (...args: unknown[]) => number };
    __qBrevoTrackerStarted?: boolean;
  }
}

function readConsent(): boolean | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' ? true : value === 'rejected' ? false : null;
  } catch {
    return null;
  }
}

function startBrevoTracker() {
  if (!clientKey || window.__qBrevoTrackerStarted) return;
  window.__qBrevoTrackerStarted = true;
  window.Brevo = window.Brevo || [] as unknown[] & { push: (...args: unknown[]) => number };
  // Brevo's loader consumes queued commands after the SDK arrives.
  const queue = window.Brevo;
  queue.push(['init', { client_key: clientKey }]);

  const script = document.createElement('script');
  script.src = 'https://cdn.brevo.com/js/sdk-loader.js';
  script.async = true;
  script.dataset.qBrevoTracker = 'true';
  document.head.appendChild(script);

  // Avoid sending query strings, which can contain private or account-specific data.
  queue.push(['page', window.location.pathname || '/', { ma_path: window.location.pathname || '/' }]);
}

export function BrevoTrackerConsent() {
  const [consent, setConsent] = useState<boolean | null>(() => readConsent());
  const [visible, setVisible] = useState(() => readConsent() === null);

  useEffect(() => {
    if (consent === true) startBrevoTracker();
  }, [consent]);

  useEffect(() => {
    const openPreferences = () => {
      setConsent(readConsent());
      setVisible(true);
    };
    window.addEventListener('q:manage-cookie-consent', openPreferences);
    return () => window.removeEventListener('q:manage-cookie-consent', openPreferences);
  }, []);

  if (!clientKey || !visible) return null;

  const saveChoice = (accepted: boolean) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'rejected');
    } catch {
      // Without a persistent choice, do not start non-essential tracking.
      if (accepted) return;
    }
    setConsent(accepted);
    setVisible(false);
    if (!accepted && window.__qBrevoTrackerStarted) window.location.reload();
  };

  return (
    <section
      aria-label="Cookie preferences"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-violet-200 bg-white p-4 text-slate-800 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:p-5"
    >
      <h2 className="text-sm font-bold">Help us improve Q</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        With your permission, Brevo uses analytics cookies to measure visits to Q. This is optional and does not affect essential features. You can change your choice at any time in Cookie preferences.
        {' '}<a href="/legal/cookie" className="font-semibold text-violet-700 underline">Read our Cookie Policy</a>.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => saveChoice(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Reject analytics</button>
        <button type="button" onClick={() => saveChoice(true)} className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-800">Allow analytics</button>
      </div>
    </section>
  );
}
