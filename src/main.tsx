import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { GlobalTextTranslator } from './components/GlobalTextTranslator';
import { OnlinePresenceProvider } from './contexts/OnlinePresenceContext';
import { BrevoTrackerConsent } from './components/BrevoTrackerConsent';
import { SupportChatLauncher } from './components/SupportChatLauncher';
import { Analytics } from '@vercel/analytics/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <GlobalTextTranslator />
        <BrevoTrackerConsent />
        <SupportChatLauncher />
        <OnlinePresenceProvider><App /></OnlinePresenceProvider>
        <Analytics />
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
