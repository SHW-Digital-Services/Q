import assert from 'node:assert/strict';
import { BREVO_CONSENT_KEY, Q_BREVO_CLIENT_KEY, publicAnalyticsPage, startBrevoTracker } from '../src/services/brevoTracking';

let choice: string | null = null; const scripts: any[] = [];
const browser: any = { location: { pathname: '/', origin: 'https://q-ai.online', search: '?code=PRIVATE_CODE' }, localStorage: { getItem: (key: string) => key === BREVO_CONSENT_KEY ? choice : null } };
Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
Object.defineProperty(globalThis, 'document', { value: { referrer: 'https://example.test/private?token=PRIVATE_TOKEN', createElement: () => ({ dataset: {} }), head: { appendChild: (script: unknown) => scripts.push(script) } }, configurable: true });
try {
  startBrevoTracker(Q_BREVO_CLIENT_KEY); assert.equal(scripts.length, 0);
  choice = 'rejected'; startBrevoTracker(Q_BREVO_CLIENT_KEY); assert.equal(scripts.length, 0);
  choice = 'accepted';
  for (const pathname of ['/app', '/app/journal', '/crm', '/crm/online', '/crm/comms', '/admin/crm']) { browser.location.pathname = pathname; startBrevoTracker(Q_BREVO_CLIENT_KEY); assert.equal(scripts.length, 0); }
  assert.equal(publicAnalyticsPage({ pathname: '/', search: '?view=app' }), false);
  assert.equal(publicAnalyticsPage({ pathname: '/', search: '?open=q' }), false);
  browser.location.pathname = '/'; startBrevoTracker(Q_BREVO_CLIENT_KEY);
  assert.equal(scripts.length, 1); assert.equal(scripts[0].src, 'https://cdn.brevo.com/js/sdk-loader.js');
  assert.deepEqual(browser.Brevo[0], ['init', { client_key: Q_BREVO_CLIENT_KEY, do_not_track_page: true }]);
  assert.equal(browser.Brevo[1][2].ma_url, 'https://q-ai.online/');
  assert.equal(browser.Brevo[1][2].ma_referrer, 'https://example.test');
  assert(!JSON.stringify(browser.Brevo).includes('PRIVATE_'));
  startBrevoTracker(Q_BREVO_CLIENT_KEY); assert.equal(scripts.length, 1);
} finally { delete (globalThis as any).window; delete (globalThis as any).document; }
console.log('PASS Brevo consent, public-page scope, sanitised page data and duplicate prevention');
