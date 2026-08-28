import React, { useState, useEffect } from 'react';
import { LayoutGrid, FileText, Target, ShieldCheck, Rocket, DollarSign, Megaphone } from 'lucide-react';
import { Navbar, ActiveTab } from './components/Navbar';
import { QAssistantView } from './components/QAssistantView';
import { LifeGuidesView } from './components/LifeGuidesView';
import { LivedExperiencesView } from './components/LivedExperiencesView';
import { JournalView } from './components/JournalView';
import { ProfileView } from './components/ProfileView';
import { CrisisModal } from './components/CrisisModel';
import { BackupModal } from './components/BackupModel';
import { SecurityLockOverlay } from './components/SecurityLockOverlay';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { AuthModal } from './components/AuthModel';
import { AuthScreen } from './components/AuthScreen';
import { SubscriptionModal } from './components/SubscriptionModal';
import { LandingPage } from './components/LandingPage';
import { HelpView } from './components/HelpView';
import { getSyncStatus, getSecuritySettings, saveSecuritySettings } from './services/storage';
import { getSupabaseClient, mapSupabaseUser } from './services/supabase';
import { SyncStatusState, SecuritySettings, AuthUser } from './types';
import { FakeNotesApp } from './components/FakeNotesApp';
import { useCamouflage } from './hooks/useCamouflage';


function isViewAppRequest() {
  if (typeof window === 'undefined') return false;

  const searchParams = new URLSearchParams(window.location.search);
  return (
    window.location.pathname === '/app' ||
    window.location.pathname.startsWith('/app/') ||
    searchParams.get('view') === 'app' ||
    searchParams.get('open') === 'q'
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(getSyncStatus());
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(getSecuritySettings());
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const s = getSecuritySettings();
    return s.enabled && s.lockScope === 'entire_app';
  });
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [crisisCountry, setCrisisCountry] = useState<string | undefined>();
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const isAppRoute = isViewAppRequest();
  const { isMasked, enableCamouflage, disableCamouflage } = useCamouflage();

  useEffect(() => {
    const handleCamouflageHotkey = (event: KeyboardEvent) => {
      if (event.altKey && event.code === 'KeyM' && !isMasked) {
        event.preventDefault();
        enableCamouflage();
      }
    };
    window.addEventListener('keydown', handleCamouflageHotkey);
    return () => window.removeEventListener('keydown', handleCamouflageHotkey);
  }, [isMasked, enableCamouflage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('paypal')) return;
    if (!currentUser) return;
    setIsSubscriptionOpen(true);
  }, [currentUser]);

  // Subscribe to Supabase Auth state changes if client configured
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const applySession = (session: { user?: any; expires_at?: number } | null) => {
      if (session?.user) {
        setCurrentUser(mapSupabaseUser(session.user));
        setSessionExpiresAt(session.expires_at ? session.expires_at * 1000 : null);
      } else {
        setCurrentUser(null);
        setSessionExpiresAt(null);
        setIsLocked(true);
      }
    };

    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Lock the app as soon as the Supabase session's expiry time is reached.
  useEffect(() => {
    if (!sessionExpiresAt) return;

    const remainingMs = sessionExpiresAt - Date.now();
    if (remainingMs <= 0) {
      setCurrentUser(null);
      setIsLocked(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentUser(null);
      setSessionExpiresAt(null);
      setIsLocked(true);
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [sessionExpiresAt]);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setSyncStatus(getSyncStatus());
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Handle Tab Switch with Journal Scope Lock
  const handleTabChange = (newTab: ActiveTab) => {
    if (
      newTab === 'journal' &&
      securitySettings.enabled &&
      securitySettings.lockScope === 'journal_only'
    ) {
      setIsLocked(true);
    }
    setActiveTab(newTab);
  };

  // Auto-Lock on Window Blur / Visibility Change
  useEffect(() => {
    if (!securitySettings.enabled || securitySettings.autoLockDelaySeconds < 0) return;

    let timeoutId: any = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const delayMs = securitySettings.autoLockDelaySeconds * 1000;
        if (delayMs <= 0) {
          setIsLocked(true);
        } else {
          timeoutId = setTimeout(() => {
            setIsLocked(true);
          }, delayMs);
        }
      } else {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [securitySettings]);

  const handleDataImported = () => {
    setSyncStatus(getSyncStatus());
    setSecuritySettings(getSecuritySettings());
  };

  const handleResetSecurity = () => {
    const reset = saveSecuritySettings({
      enabled: false,
      lockType: 'pin',
      pinCode: '',
      patternPath: [],
      autoLockDelaySeconds: 0,
      lockScope: 'entire_app'
    });
    setSecuritySettings(reset);
    setIsLocked(false);
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('Sign out failed:', error);
      }
    }
    setCurrentUser(null);
    setSessionExpiresAt(null);
    setIsLocked(true);
  };

  const isLockActive =
    isLocked &&
    securitySettings.enabled &&
    (securitySettings.lockScope === 'entire_app' || activeTab === 'journal');

  if (isMasked) return <FakeNotesApp onUnlock={disableCamouflage} requiredPin={securitySettings.enabled && securitySettings.lockType === 'pin' ? securitySettings.pinCode : undefined} />;

  if (!isAppRoute) return <><LandingPage /><button onClick={enableCamouflage} className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-md">Disguise Mode (Alt+M)</button></>;

  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onUserSignedIn={(user) => setCurrentUser(user)}
          onOpenCrisis={() => setIsCrisisOpen(true)}
        />
        <CrisisModal isOpen={isCrisisOpen} onClose={() => { setIsCrisisOpen(false); setCrisisCountry(undefined); }} initialCountry={crisisCountry} />
        <button onClick={enableCamouflage} className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-md">Disguise Mode (Alt+M)</button>
      </>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-rose-50 via-violet-50 to-sky-50 font-sans text-slate-900 antialiased selection:bg-fuchsia-600 selection:text-white">
      {/* Soft Pride-spectrum ambient colour keeps content readable while adding identity. */}
      <div className="pointer-events-none fixed -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-rose-300/25 blur-[90px]" />
      <div className="pointer-events-none fixed -right-28 top-1/3 -z-10 h-80 w-80 rounded-full bg-sky-300/25 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-violet-300/25 blur-[100px]" />

      {/* Mobile-First App Shell Container */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-white/72 pb-24 shadow-2xl shadow-purple-950/5 backdrop-blur-xl sm:max-w-2xl sm:border-x sm:border-white/70 sm:pb-0 lg:max-w-5xl">
        {/* Main Navigation (Sticky Header & Bottom Nav) */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          syncStatus={syncStatus}
          onOpenCrisis={() => setIsCrisisOpen(true)}
          onOpenBackup={() => setIsBackupOpen(true)}
          onOpenSecurity={() => setIsSecurityOpen(true)}
          onLockNow={() => setIsLocked(true)}
          isLockEnabled={securitySettings.enabled}
          currentUser={currentUser}
          onOpenAuth={(mode = 'login') => {
            setAuthInitialMode(mode);
            setIsAuthOpen(true);
          }}
          onOpenSubscription={() => setIsSubscriptionOpen(true)}
          onSignOut={handleSignOut}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6">
          {activeTab === 'chat' && <QAssistantView userId={currentUser.id} onOpenReflection={() => setActiveTab('journal')} onOpenCrisis={(country) => { setCrisisCountry(country); setIsCrisisOpen(true); }} />}
          {activeTab === 'guides' && <LifeGuidesView />}
          {activeTab === 'stories' && <LivedExperiencesView />}
          {activeTab === 'journal' && (
            <JournalView
              userId={currentUser.id}
              onAskQSupport={() => {
                setActiveTab('chat');
              }}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              onUserChanged={(user) => setCurrentUser(user)}
              onOpenAccount={() => {
                setAuthInitialMode('login');
                setIsAuthOpen(true);
              }}
              onOpenBackup={() => setIsBackupOpen(true)}
              onOpenSecurity={() => setIsSecurityOpen(true)}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
              onSignOut={handleSignOut}
            />
          )}
          {activeTab === 'help' && (
            <HelpView
              onNavigate={setActiveTab}
              onOpenCrisis={() => setIsCrisisOpen(true)}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Security Lock Screen Overlay */}
      {isLockActive && (
        <SecurityLockOverlay
          settings={securitySettings}
          onUnlock={() => setIsLocked(false)}
          onOpenCrisis={() => setIsCrisisOpen(true)}
          onResetSecurity={handleResetSecurity}
          scopeLabel={
            securitySettings.lockScope === 'journal_only'
              ? 'Private Journal Locked'
              : 'Q Privacy Lock'
          }
        />
      )}

      {/* Modals */}
      <CrisisModal isOpen={isCrisisOpen} onClose={() => { setIsCrisisOpen(false); setCrisisCountry(undefined); }} initialCountry={crisisCountry} />
      <button onClick={enableCamouflage} className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs rounded-lg text-slate-200 shadow-md">Disguise Mode (Alt+M)</button>
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onDataImported={handleDataImported}
      />
      <SecuritySettingsModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        onSettingsUpdated={(updated) => setSecuritySettings(updated)}
        onTestLock={() => setIsLocked(true)}
      />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUserChanged={(user) => setCurrentUser(user)}
        initialMode={authInitialMode}
      />
      <SubscriptionModal isOpen={isSubscriptionOpen} onClose={() => setIsSubscriptionOpen(false)} />
    </div>
  );
}
