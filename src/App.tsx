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
import { getSyncStatus, getSecuritySettings, saveSecuritySettings } from './services/storage';
import { getSupabaseClient, mapSupabaseUser } from './services/supabase';
import { SyncStatusState, SecuritySettings, AuthUser } from './types';


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
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const isAppRoute = isViewAppRequest();

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

  if (!isAppRoute) {
    return <LandingPage />;
  }

  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onUserSignedIn={(user) => setCurrentUser(user)}
          onOpenCrisis={() => setIsCrisisOpen(true)}
        />
        <CrisisModal isOpen={isCrisisOpen} onClose={() => setIsCrisisOpen(false)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 selection:bg-purple-600 selection:text-white font-sans antialiased flex flex-col relative overflow-x-hidden">
      {/* Background subtle purple & silver ambient light */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-200/40 rounded-full blur-[150px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-slate-200/50 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Mobile-First App Shell Container */}
      <div className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-slate-50 sm:border-x border-slate-200/80 sm:shadow-xl flex flex-col relative pb-20 sm:pb-0">
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
        <main className="flex-1 p-3 sm:p-5">
          {activeTab === 'chat' && <QAssistantView userId={currentUser.id} onOpenReflection={() => setActiveTab('journal')} />}
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
      <CrisisModal isOpen={isCrisisOpen} onClose={() => setIsCrisisOpen(false)} />
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
