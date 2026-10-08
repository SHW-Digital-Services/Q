import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StaffChat from './components/StaffChat';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { GlobalTextTranslator } from './components/GlobalTextTranslator';
import { OnlinePresenceProvider } from './contexts/OnlinePresenceContext';
import { BrevoTrackerConsent } from './components/BrevoTrackerConsent';
import { Analytics } from '@vercel/analytics/react';
import { installChunkLoadRecovery } from './services/chunkLoadRecovery';

installChunkLoadRecovery(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <GlobalTextTranslator />
        {window.location.pathname !== '/support' && <BrevoTrackerConsent />}
        <OnlinePresenceProvider><App /><StaffChat /></OnlinePresenceProvider>
        {window.location.pathname !== '/support' && <Analytics />}
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
