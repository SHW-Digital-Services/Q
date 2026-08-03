import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, MessageCircle, BookOpen, Users, Notebook, CreditCard, LogOut } from 'lucide-react';
import { QLogo } from './QLogo';

export type ActiveTab = 'chat' | 'guides' | 'stories' | 'journal';

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
  const navItems = [
    { id: 'chat' as const, label: 'Q Intelligence', icon: MessageCircle },
    { id: 'guides' as const, label: 'Life Guides', icon: BookOpen },
    { id: 'stories' as const, label: 'Peer Knowledge', icon: Users },
    { id: 'journal' as const, label: 'Private Journal', icon: Notebook }
  ];

  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 text-slate-800 shadow-sm">
        <div className="px-3 sm:px-5">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('chat')}>
              <QLogo size="sm" />
              <div className="hidden sm:block">
                <p className="text-sm font-semibold tracking-tight">Q</p>
                <p className="text-[11px] text-slate-500">Safe support</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all shadow-sm"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={onOpenCrisis}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <span>24/7 Helpline</span>
              </button>

              <button
                onClick={onOpenSubscription}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 hover:brightness-105"
              >
                <CreditCard className="w-4 h-4" />
                <span>Subscribe</span>
              </button>

              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

      </header>

      <nav className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-inner sm:hidden">
        <div className="max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto px-3 sm:px-5 py-2">
          <div className="grid grid-cols-6 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center rounded-3xl px-2 py-3 text-center text-[11px] font-semibold transition ${
                    active
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-1 leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
