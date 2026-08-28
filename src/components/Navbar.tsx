import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, MessageCircle, BookOpen, Users, Notebook, CreditCard, LogOut, UserCircle, CircleHelp } from 'lucide-react';
import { QLogo } from './QLogo';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';

export type ActiveTab = 'chat' | 'guides' | 'stories' | 'journal' | 'profile' | 'help';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  syncStatus: any;
  onOpenCrisis: () => void;
  onOpenBackup: () => void;
  onOpenSecurity: () => void;
  onLockNow: () => void;
  isLockEnabled: boolean;
  currentUser: any;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
  onOpenSubscription: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  syncStatus,
  onOpenCrisis,
  onOpenBackup,
  onOpenSecurity,
  onLockNow,
  isLockEnabled,
  currentUser,
  onOpenAuth,
  onOpenSubscription,
  onSignOut
}) => {
  const { t } = useLanguage();
  const navItems = [
    { id: 'chat' as const, label: t('qIntelligence'), shortLabel: 'Q', icon: MessageCircle, activeClass: 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-fuchsia-500/25' },
    { id: 'guides' as const, label: t('lifeGuides'), shortLabel: t('lifeGuides'), icon: BookOpen, activeClass: 'bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-orange-500/25' },
    { id: 'stories' as const, label: t('peerKnowledge'), shortLabel: t('peerKnowledge'), icon: Users, activeClass: 'bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-sky-500/25' },
    { id: 'journal' as const, label: t('privateJournal'), shortLabel: t('privateJournal'), icon: Notebook, activeClass: 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-500/25' },
    { id: 'profile' as const, label: t('profile'), shortLabel: t('profile'), icon: UserCircle, activeClass: 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-pink-500/25' },
    { id: 'help' as const, label: t('help'), shortLabel: t('help'), icon: CircleHelp, activeClass: 'bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-sky-500/25' }
  ];

  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="pride-topline mobile-safe-top sticky top-0 z-40 border-b border-purple-100/80 bg-white/90 text-slate-800 shadow-lg shadow-purple-950/5 backdrop-blur-xl">
        <div className="px-3 sm:px-5">
          <div className="flex min-h-14 items-center gap-3 py-2 sm:min-h-16">
            <div className="flex shrink-0 items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('chat')}>
              <QLogo size="sm" />
              <div>
                <p className="text-sm font-semibold tracking-tight">Q</p>
                <p className="hidden text-[11px] text-slate-500 sm:block">{t('safeSupport')}</p>
              </div>
            </div>

            <nav aria-label={t('primaryNavigation')} className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto rounded-2xl border border-purple-100 bg-gradient-to-r from-rose-50 via-violet-50 to-sky-50 p-1 sm:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-[10px] font-bold transition lg:px-2.5 lg:text-[11px] ${
                      active
                        ? `${item.activeClass} shadow-md`
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="ms-auto sm:hidden"><LanguageSelector compact /></div>

          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pb-2 pt-2 sm:hidden">
            <button
              onClick={onOpenCrisis}
              className="flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 shadow-sm transition-all hover:bg-red-100"
            >
              {t('helpline')}
            </button>
            <button
              onClick={onOpenSubscription}
              className="pride-spectrum flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/20 transition-all hover:brightness-105 active:scale-[.98]"
            >
              <CreditCard className="h-4 w-4" />
              {t('subscribe')}
            </button>
          </div>

          <div className="hidden items-center justify-end gap-2 border-t border-slate-100 py-2 sm:flex">
              <LanguageSelector compact />
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? t('lightMode') : t('darkMode')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all shadow-sm"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={onOpenCrisis}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <span>{t('helpline')}</span>
              </button>

              <button
                onClick={onOpenSubscription}
                className="pride-spectrum flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/20 transition-all hover:brightness-105 active:scale-[.98]"
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('subscribe')}</span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-sm"
              >
                <UserCircle className="w-4 h-4" />
                <span>{t('profile')}</span>
              </button>

              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('signOut')}</span>
              </button>
          </div>
        </div>

      </header>

      <nav className="mobile-safe-bottom sticky bottom-0 z-40 border-t border-purple-100/80 bg-white/95 shadow-[0_-10px_30px_rgba(88,28,135,0.08)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto max-w-md px-2 pt-2">
          <div className="grid grid-cols-6 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-center text-[10px] font-semibold transition ${
                    active
                      ? `${item.activeClass} shadow-lg -translate-y-0.5`
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-1 leading-none">{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
