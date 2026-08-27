import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Database,
  ArrowRight,
  LogOut,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { AuthUser } from '../types';
import { getSupabaseClient, getSupabaseEnvConfig, mapSupabaseUser } from '../services/supabase';
import { QLogo } from './QLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onUserChanged: (user: AuthUser | null) => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const envConfig = getSupabaseEnvConfig();

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || (mode !== 'forgot' && !password)) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    const supabase = getSupabaseClient();

    // 1. Authentication requires a configured Supabase project.
    if (!supabase || !envConfig.isConfigured) {
      setErrorMessage('Supabase authentication is not configured yet. Please add your project credentials.');
      return;
    }

    // 2. Real Supabase Integration
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName || email.split('@')[0]
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          const authUser = mapSupabaseUser(data.user);
          onUserChanged(authUser);
          setSuccessMessage(
            data.session
              ? 'Account created and signed in!'
              : 'Sign-up successful! Please check your email to confirm your account.'
          );
          if (data.session) setTimeout(() => onClose(), 1200);
        }
      } else if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data.user) {
          const authUser = mapSupabaseUser(data.user);
          onUserChanged(authUser);
          setSuccessMessage('Signed in successfully!');
          setTimeout(() => onClose(), 1000);
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });

        if (error) throw error;
        setSuccessMessage('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    onUserChanged(null);
    setLoading(false);
    setSuccessMessage('Signed out successfully.');
    setTimeout(() => onClose(), 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Banner */}
        <div className="p-5 bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-purple-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <QLogo size="sm" />
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                Q Supabase Authentication
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-700/80 border border-purple-400/50 text-purple-200">
                  {envConfig.isConfigured ? 'Supabase Connected' : 'Supabase Required'}
                </span>
              </h2>
              <p className="text-xs text-purple-200 font-medium">
                {currentUser
                  ? 'Manage your signed in account details'
                  : mode === 'signup'
                  ? 'Create your confidential Q account'
                  : mode === 'forgot'
                  ? 'Reset your account password'
                  : 'Sign in to access synced guides & data'}
              </p>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-800">
          <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-950">
              <Database className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Supabase Auth Engine</span>
            </div>
            <p className="text-[11px] text-purple-800">
              Create an account or log in to access your private Q space.
            </p>
          </div>

          {/* If User is Currently Signed In */}
          {currentUser ? (
            <div className="space-y-4 py-2 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 border-2 border-purple-500 text-purple-700 flex items-center justify-center text-xl font-bold mx-auto shadow-sm">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{currentUser.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{currentUser.email}</p>
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  ✓ Active Authenticated Session
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loading ? 'Signing out...' : 'Sign Out of Account'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector: Login vs Sign Up */}
              <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'login'
                      ? 'bg-white text-purple-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'signup'
                      ? 'bg-white text-purple-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>

              {/* Error and Success Banners */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Form Input Fields */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Full Name or Preferred Alias
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-600">Password</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-[11px] font-semibold text-purple-700 hover:text-purple-900"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>
                        {mode === 'signup'
                          ? 'Create Supabase Account'
                          : mode === 'forgot'
                          ? 'Send Password Reset Email'
                          : 'Sign In with Supabase'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

            </>
          )}
        </div>
      </div>
    </div>
  );
};
