import { useEffect, useState } from 'react';
import { BREVO_CONSENT_KEY, Q_BREVO_CLIENT_KEY, readBrevoConsent, startBrevoTracker } from '../services/brevoTracking';

const CONSENT_KEY = BREVO_CONSENT_KEY;
const clientKey = import.meta.env.VITE_BREVO_CLIENT_KEY?.trim() || Q_BREVO_CLIENT_KEY;

const readConsent = readBrevoConsent;

export function BrevoTrackerConsent() {
  const [consent, setConsent] = useState<boolean | null>(() => readConsent());
  const [visible, setVisible] = useState(() => readConsent() === null);
  const [masked, setMasked] = useState(() => {
    try { return localStorage.getItem('q_camouflage_active') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const onCamouflage = (event: Event) => setMasked(Boolean((event as CustomEvent<{ active: boolean }>).detail?.active));
    window.addEventListener('q:camouflage', onCamouflage);
    return () => window.removeEventListener('q:camouflage', onCamouflage);
  }, []);

  useEffect(() => {
    if (consent === true) startBrevoTracker(clientKey);
  }, [consent]);

  useEffect(() => {
    const openPreferences = () => {
      setConsent(readConsent());
      setVisible(true);
    };
    window.addEventListener('q:manage-cookie-consent', openPreferences);
    return () => window.removeEventListener('q:manage-cookie-consent', openPreferences);
  }, []);

  // Consent controls must not reveal Q or block the Notes return control.
  if (!clientKey || !visible || masked) return null;

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
