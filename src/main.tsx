import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { GlobalTextTranslator } from './components/GlobalTextTranslator';
import { OnlinePresenceProvider } from './contexts/OnlinePresenceContext';
import { BrevoTrackerConsent } from './components/BrevoTrackerConsent';
import { Analytics } from '@vercel/analytics/react';
import { installChunkLoadRecovery } from './services/chunkLoadRecovery';
import UserActivityTracker from './components/UserActivityTracker';
import { crmMicrosoftSsoPendingKey } from './services/supabase';

const StaffChat = lazy(() => import('./components/StaffChat'));

installChunkLoadRecovery(window);

// Supabase can send SAML validation errors to the configured Site URL instead
// of the requested redirect URL. If this browser started CRM SSO, restore the
// CRM route and keep only the short error code (never the raw SAML assertion).
const authCallbackParams = new URLSearchParams(window.location.search);
if (
  window.location.pathname === '/' &&
  window.sessionStorage.getItem(crmMicrosoftSsoPendingKey) === '1' &&
  (authCallbackParams.has('error') || authCallbackParams.has('error_description'))
) {
  const errorCode = authCallbackParams.get('error_code') || authCallbackParams.get('error') || 'unknown';
  window.history.replaceState({}, '', `/crm?error_code=${encodeURIComponent(errorCode)}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <GlobalTextTranslator />
        {window.location.pathname !== '/support' && <BrevoTrackerConsent />}
        <OnlinePresenceProvider><UserActivityTracker /><App />{!['/crm/chat', '/admin/crm/chat'].includes(window.location.pathname) && <Suspense fallback={null}><StaffChat page={false} /></Suspense>}</OnlinePresenceProvider>
        {window.location.pathname !== '/support' && <Analytics />}
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
