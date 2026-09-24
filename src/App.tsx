import React, { Suspense, lazy, useCallback, useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Navbar, ActiveTab } from './components/Navbar';
import { CrisisModal } from './components/CrisisModel';
import { BackupModal } from './components/BackupModel';
import { SecurityLockOverlay } from './components/SecurityLockOverlay';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { AuthModal } from './components/AuthModel';
import { AuthScreen } from './components/AuthScreen';
import { SubscriptionModal } from './components/SubscriptionModal';
import { LandingPage } from './components/LandingPage';
import { CrmAccessPage } from './components/CrmAccessPage';
import { getSyncStatus, getSecuritySettings, saveSecuritySettings } from './services/storage';
import { getSupabaseClient, mapSupabaseUser } from './services/supabase';
import { SyncStatusState, SecuritySettings, AuthUser } from './types';
import { FakeNotesApp } from './components/FakeNotesApp';
import { useCamouflage } from './hooks/useCamouflage';
import { LanguageSelector } from './components/LanguageSelector';
import { useLanguage } from './contexts/LanguageContext';
import { PremiumProvider } from './contexts/PremiumContext';
import { ContinuityProvider, ContinuitySettings } from './contexts/ContinuityContext';
import { setStorageUser } from './services/storage';
import { LegalFooter } from './components/LegalFooter';

const QAssistantView = lazy(() => import('./components/QAssistantView').then(({ QAssistantView }) => ({ default: QAssistantView })));
const LifeGuidesView = lazy(() => import('./components/LifeGuidesView').then(({ LifeGuidesView }) => ({ default: LifeGuidesView })));
const LivedExperiencesView = lazy(() => import('./components/LivedExperiencesView').then(({ LivedExperiencesView }) => ({ default: LivedExperiencesView })));
const JournalView = lazy(() => import('./components/JournalView').then(({ JournalView }) => ({ default: JournalView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(({ ProfileView }) => ({ default: ProfileView })));
const HelpView = lazy(() => import('./components/HelpView').then(({ HelpView }) => ({ default: HelpView })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(({ AdminPanel }) => ({ default: AdminPanel })));
const DeveloperPage = lazy(() => import('./components/DeveloperPage').then(({ DeveloperPage }) => ({ default: DeveloperPage })));
const NewsUpdatesPage = lazy(() => import('./components/NewsUpdatesPage').then(({ NewsUpdatesPage }) => ({ default: NewsUpdatesPage })));
const GuidedProgrammes = lazy(() => import('./components/GuidedProgrammes').then(({ GuidedProgrammes }) => ({ default: GuidedProgrammes })));


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

function LoadingView({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center p-6 text-sm font-semibold text-slate-500 dark:text-slate-300">
      {label}
    </div>
  );
}

function StatusPageButton() {
  return (
    <a
      href="https://status.q-ai.online"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Q Status Page in a new tab"
      className="q-fixed-top-left q-compact-fixed fixed z-[60] inline-flex min-h-11 items-center gap-1.5 rounded-full border border-purple-300/60 bg-slate-950/90 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
    >
      <span className="q-fixed-label">Status Page</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
    </a>
  );
}

export default function App() {
  const { t } = useLanguage();
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
  const [canAccessCrm, setCanAccessCrm] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [crmAccessChecked, setCrmAccessChecked] = useState(false);
  const [isProgrammeCourseOpen, setIsProgrammeCourseOpen] = useState(false);
  const [launchEnabled, setLaunchEnabled] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const previewActive = !!currentUser && previewUserId === currentUser.id;
  const isAppRoute = previewActive || (launchEnabled && isViewAppRequest());
  const isNewsRoute = typeof window !== 'undefined' && ['/news', '/updates'].includes(window.location.pathname);
  const isCrmRoute = typeof window !== 'undefined' && ['/crm', '/admin/crm'].includes(window.location.pathname);
  const isDeveloperRoute = typeof window !== 'undefined' && window.location.pathname === '/developer';

  useEffect(() => {
    let cancelled = false;
    const refreshLaunch = async () => {
      try {
        const response = await fetch('/api/v1/admin/site-settings/launch', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (!cancelled) setLaunchEnabled(data?.enabled === true);
      } catch {
        if (!cancelled) setLaunchEnabled(false);
      }
    };
    void refreshLaunch();
    const timer = window.setInterval(refreshLaunch, 15_000);
    window.addEventListener('focus', refreshLaunch);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refreshLaunch); };
  }, []);

  const startPreview = async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) throw new Error('Sign in as an Admin to preview the site.');
    const response = await fetch('/api/v1/admin/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const staff = response.ok ? await response.json() : null;
    if (staff?.role !== 'partner_admin') throw new Error('Only an Admin can preview the site.');
    const { data: latest } = await supabase!.auth.getSession();
    if (latest.session?.user.id !== staff.user.id) throw new Error('Your session changed. Please try again.');
    setPreviewUserId(staff.user.id);
    setIsAdminPanelOpen(false);
  };
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

  // Ask the protected admin endpoint for the signed-in user's effective role.
  // Visibility is only a convenience; every CRM request remains server-authorised.
  useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      setPreviewUserId(null);
      setCanAccessCrm(false);
      setCrmAccessChecked(true);
      setIsAdminPanelOpen(false);
      return;
    }

    const checkCrmAccess = async () => {
      setCrmAccessChecked(false);
      const supabase = getSupabaseClient();
      const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setCanAccessCrm(false);
          setCrmAccessChecked(true);
        }
        return;
      }

      try {
        const response = await fetch('/api/v1/admin/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Not authorised for CRM access.');
        const staff = await response.json();
        const allowed = staff.role === 'staff' || staff.role === 'partner_admin';
        if (cancelled) return;
        setCanAccessCrm(allowed);
        setCrmAccessChecked(true);
        if (staff.role !== 'partner_admin') setPreviewUserId(null);

      } catch {
        if (!cancelled) {
          setPreviewUserId(null);
          setCanAccessCrm(false);
          setCrmAccessChecked(true);
          setIsAdminPanelOpen(false);
        }
      }
    };

    void checkCrmAccess();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Subscribe to Supabase Auth state changes if client configured
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const applySession = (session: { user?: any; expires_at?: number } | null) => {
      setStorageUser(session?.user?.id);
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
    setIsAdminPanelOpen(false);
    setIsProgrammeCourseOpen(false);
    if (
      newTab === 'journal' &&
      securitySettings.enabled &&
      securitySettings.lockScope === 'journal_only'
    ) {
      setIsLocked(true);
    }
    setActiveTab(newTab);
  };
  const handleProgrammeCourseOpenChange = useCallback((open: boolean) => {
    setIsProgrammeCourseOpen(open);
  }, []);

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

  if (isNewsRoute) return <><StatusPageButton /><Suspense fallback={<LoadingView label="Loading news..." />}><NewsUpdatesPage /></Suspense></>;
  if (isDeveloperRoute) return <><StatusPageButton /><Suspense fallback={<LoadingView label="Loading developer docs..." />}><DeveloperPage /></Suspense></>;

  if (isCrmRoute && !previewActive) {
    if (!currentUser) {
      return <><StatusPageButton /><CrmAccessPage onUserSignedIn={(user) => { setStorageUser(user.id); setCurrentUser(user); }} /></>;
    }
    if (!crmAccessChecked) {
      return <><StatusPageButton /><main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-sm font-semibold text-slate-200">Checking CRM access...</main></>;
    }
    if (!canAccessCrm) {
      return <><StatusPageButton /><CrmAccessPage onUserSignedIn={(user) => { setStorageUser(user.id); setCurrentUser(user); }} /></>;
    }
    return (
      <div className="min-h-dvh bg-slate-950 p-0 text-slate-100 sm:p-6">
        <StatusPageButton />
        <Suspense fallback={<LoadingView label="Loading CRM..." />}>
          <AdminPanel onPreview={startPreview} enabled={launchEnabled} onToggle={setLaunchEnabled} onClose={() => { window.location.href = '/'; }} onSignOut={handleSignOut} />
        </Suspense>
      </div>
    );
  }

  if (!isAppRoute) return <><StatusPageButton /><div className="fixed right-4 top-4 z-50"><LanguageSelector compact /></div><LandingPage launchEnabled={launchEnabled} onToggleLaunch={setLaunchEnabled} onPreview={startPreview} /><button onClick={enableCamouflage} className="fixed left-4 top-20 z-40 min-h-11 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-md">{t('disguise')} <span className="q-fixed-label">(Alt+M)</span></button></>;

  if (!currentUser) {
    return (
      <>
        <StatusPageButton />
        <div className="fixed right-4 top-4 z-50"><LanguageSelector compact /></div>
        <AuthScreen
          onUserSignedIn={(user) => { setStorageUser(user.id); setCurrentUser(user); }}
          onOpenCrisis={() => setIsCrisisOpen(true)}
        />
        <CrisisModal isOpen={isCrisisOpen} onClose={() => { setIsCrisisOpen(false); setCrisisCountry(undefined); }} initialCountry={crisisCountry} />
        <button onClick={enableCamouflage} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 min-h-11 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-md">{t('disguise')} <span className="q-fixed-label">(Alt+M)</span></button>
      </>
    );
  }

  return (
    <PremiumProvider key={currentUser.id} userId={currentUser.id} upgrade={() => setIsSubscriptionOpen(true)}><ContinuityProvider>
    <div className="q-app-shell relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-rose-50 via-violet-50 to-sky-50 font-sans text-slate-900 antialiased selection:bg-fuchsia-600 selection:text-white">
      <StatusPageButton />
      {previewActive && <div className="relative z-50 mt-14 flex items-center justify-center gap-4 bg-amber-100 px-4 py-3 text-sm text-amber-950"><span>Admin preview: Public site {launchEnabled ? 'live' : 'on waitlist'}</span><button type="button" onClick={() => setPreviewUserId(null)} className="font-bold underline">Exit preview</button></div>}
      {/* Soft Pride-spectrum ambient colour keeps content readable while adding identity. */}
      <div className="pointer-events-none fixed -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-rose-300/25 blur-[90px]" />
      <div className="pointer-events-none fixed -right-28 top-1/3 -z-10 h-80 w-80 rounded-full bg-sky-300/25 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-violet-300/25 blur-[100px]" />

      {/* Mobile-First App Shell Container */}
      <div className="q-content-shell relative mx-auto flex min-h-screen w-full min-w-0 max-w-md flex-col bg-white/72 pb-24 shadow-2xl shadow-purple-950/5 backdrop-blur-xl sm:max-w-2xl sm:border-x sm:border-white/70 sm:pb-0 lg:max-w-5xl xl:max-w-6xl">
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
          <Suspense fallback={<LoadingView />}>
            {isAdminPanelOpen && canAccessCrm && <AdminPanel onPreview={startPreview} enabled={launchEnabled} onToggle={setLaunchEnabled} onClose={() => setIsAdminPanelOpen(false)} onSignOut={handleSignOut} />}
            {!isAdminPanelOpen && activeTab === 'chat' && <QAssistantView userId={currentUser.id} onOpenReflection={() => setActiveTab('journal')} onOpenCrisis={(country) => { setCrisisCountry(country); setIsCrisisOpen(true); }} onOpenSubscription={() => setIsSubscriptionOpen(true)} />}
            {!isAdminPanelOpen && activeTab === 'guides' && <><GuidedProgrammes onCourseOpenChange={handleProgrammeCourseOpenChange} />{!isProgrammeCourseOpen && <LifeGuidesView />}</>}
            {!isAdminPanelOpen && activeTab === 'stories' && <LivedExperiencesView />}
            {!isAdminPanelOpen && activeTab === 'journal' && (
              <JournalView
                userId={currentUser.id}
                onAskQSupport={() => {
                  setActiveTab('chat');
                }}
              />
            )}
            {!isAdminPanelOpen && activeTab === 'profile' && <ContinuitySettings />}
            {!isAdminPanelOpen && activeTab === 'profile' && (
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
            {!isAdminPanelOpen && activeTab === 'help' && (
              <HelpView
                onNavigate={setActiveTab}
                onOpenCrisis={() => setIsCrisisOpen(true)}
                onOpenSubscription={() => setIsSubscriptionOpen(true)}
              />
            )}
          </Suspense>
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
      <button onClick={enableCamouflage} className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 z-40 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 shadow-md hover:bg-slate-700 sm:bottom-4">{t('disguise')} (Alt+M)</button>
      <BackupModal
        isOpen={isBackupOpen}
        userId={currentUser?.id}
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
      <LegalFooter />
    </div>
    </ContinuityProvider></PremiumProvider>
  );
}
