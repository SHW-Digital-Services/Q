export const Q_BREVO_CLIENT_KEY = '2v6dwksxycatar2dj3vmcuqd';
export const BREVO_CONSENT_KEY = 'q_brevo_analytics_consent_v1';

declare global {
  interface Window {
    Brevo?: unknown[] & { push: (...args: unknown[]) => number };
    __qBrevoTrackerStarted?: boolean;
  }
}

export function publicAnalyticsPage(location: Pick<Location, 'pathname' | 'search'>): boolean {
  const query = new URLSearchParams(location.search);
  return ['/', '/news', '/updates', '/developer'].includes(location.pathname) &&
    query.get('view') !== 'app' && query.get('open') !== 'q';
}

export function readBrevoConsent(): boolean | null {
  try {
    const value = window.localStorage.getItem(BREVO_CONSENT_KEY);
    return value === 'accepted' ? true : value === 'rejected' ? false : null;
  } catch { return null; }
}

export function startBrevoTracker(clientKey: string) {
  if (!clientKey || readBrevoConsent() !== true || !publicAnalyticsPage(window.location) || window.__qBrevoTrackerStarted) return;
  window.__qBrevoTrackerStarted = true;
  window.Brevo = window.Brevo || [] as unknown[] & { push: (...args: unknown[]) => number };
  // Disable the SDK's automatic full-URL page event; send a sanitised event below.
  window.Brevo.push(['init', { client_key: clientKey, do_not_track_page: true }]);
  const script = document.createElement('script');
  script.src = 'https://cdn.brevo.com/js/sdk-loader.js';
  script.async = true; script.dataset.qBrevoTracker = 'true';
  document.head.appendChild(script);
  let referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).origin : ''; } catch { /* No referrer. */ }
  const pathname = window.location.pathname || '/';
  window.Brevo.push(['page', pathname, {
    ma_url: `${window.location.origin}${pathname}`, ma_path: pathname,
    ma_title: 'Q', ma_referrer: referrer,
  }]);
}
