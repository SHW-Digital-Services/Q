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

const StaffChat = lazy(() => import('./components/StaffChat'));

installChunkLoadRecovery(window);

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
