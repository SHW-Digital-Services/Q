import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Heart,
  Database,
  Lock as LockIcon,
} from 'lucide-react';
import { AuthUser } from '../types';
import { getSupabaseClient, getSupabaseEnvConfig, mapSupabaseUser } from '../services/supabase';
import { QLogo } from './QLogo';
import { LegalFooter } from './LegalFooter';

interface AuthScreenProps {
  onUserSignedIn: (user: AuthUser) => void;
  onOpenCrisis?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onUserSignedIn,
  onOpenCrisis
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotFeedback, setForgotFeedback] = useState<string | null>(null);

  const envConfig = getSupabaseEnvConfig();

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotFeedback(null);

    if (!forgotEmail.trim()) {
      setForgotFeedback('Please enter the email address for the account.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await fetch('/api/v1/admin/password-reset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), message: forgotMessage.trim() })
      });
      const resText = await response.text();
      let payload: any = {};
      try {
        payload = JSON.parse(resText);
      } catch {
        if (!response.ok) {
          throw new Error(`Server error (${response.status}): ${resText.slice(0, 100)}`);
        }
      }
      if (!response.ok) throw new Error(payload.error || payload.message || 'Unable to submit the password reset request.');
      setForgotFeedback('Your request has been sent to the admin team. They will review it shortly.');
      setForgotEmail('');
      setForgotMessage('');
      setTimeout(() => setShowForgotModal(false), 1200);
    } catch (error: any) {
      setForgotFeedback(error.message || 'Unable to submit the password reset request.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || (mode !== 'forgot' && !password)) {
      setErrorMessage('Please fill in your email address and password.');
      return;
    }

    const supabase = getSupabaseClient();

    // Authentication requires a configured Supabase project.
    if (!supabase || !envConfig.isConfigured) {
      setErrorMessage('Supabase authentication is not configured yet. Please add your project credentials.');
      return;
    }

    // Real Supabase Authentication
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
          if (authUser) {
            setSuccessMessage(
              data.session
                ? 'Account created and signed in!'
                : 'Sign-up successful! Please check your email to verify.'
            );
            if (data.session) {
              setTimeout(() => onUserSignedIn(authUser), 800);
            }
          }
        }
      } else if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data.user) {
          const authUser = mapSupabaseUser(data.user);
          if (authUser) {
            setSuccessMessage('Welcome back! Loading your secure session...');
            setTimeout(() => onUserSignedIn(authUser), 600);
          }
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
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 text-white flex flex-col justify-between items-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Ambient background glow circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Branding & Header */}
      <div className="w-full max-w-md mx-auto pt-6 pb-4 text-center z-10">
        <div className="inline-flex p-3 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl mb-4 animate-bounce-short">
          <QLogo size="lg" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
          Q Intelligence & Community
        </h1>
        <p className="text-xs sm:text-sm text-purple-200/90 font-medium max-w-xs mx-auto leading-relaxed">
          Your confidential, safe LGBTQ+ AI companion, life guides & encrypted journal.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md mx-auto bg-white text-slate-900 border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto">
        {/* Mode Selector Tabs */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex w-full rounded-2xl bg-slate-200/70 p-1 border border-slate-300/60">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'login'
                  ? 'bg-white text-purple-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <LogIn className="w-4 h-4 text-purple-600" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'signup'
                  ? 'bg-white text-purple-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <UserPlus className="w-4 h-4 text-purple-600" />
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-950">
              <Database className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Supabase Auth Engine</span>
            </div>
            <p className="text-[11px] text-purple-800 leading-normal">
              Create an account or log in to access your private Q space.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name or Display Alias
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(true);
                        setForgotFeedback(null);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
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
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signup'
                      ? 'Create Confidential Account'
                      : mode === 'forgot'
                        ? 'Send Password Reset Link'
                        : 'Sign In to Q App'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy & Security Guarantees */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Private</span>
            </span>
            <span className="flex items-center gap-1">
              <LockIcon className="w-3.5 h-3.5 text-purple-600" />
              <span>PIN Lock Protection</span>
            </span>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Password reset request</h3>
                <p className="mt-1 text-xs text-slate-500">Send your email to the admin team and they can issue a temporary password for you.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotFeedback(null);
                }}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="text-lg">×</span>
              </button>
            </div>

            <form onSubmit={handleForgotPasswordRequest} className="mt-4 space-y-3">
              {forgotFeedback && (
                <div className={`rounded-xl border p-3 text-xs font-semibold ${forgotFeedback.includes('sent') || forgotFeedback.includes('review') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                  {forgotFeedback}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Email address</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium focus:border-purple-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">What happened?</label>
                <textarea
                  rows={4}
                  value={forgotMessage}
                  onChange={(e) => setForgotMessage(e.target.value)}
                  placeholder="Tell us a bit about the issue and we’ll help you get back in."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium focus:border-purple-600 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full rounded-2xl bg-purple-600 px-3 py-3 text-xs font-bold text-white transition hover:bg-purple-700 disabled:opacity-60"
              >
                {forgotLoading ? 'Sending request…' : 'Send request to admin'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer Support & Lifeline Link */}
      <div className="w-full z-10">
        <div className="max-w-md mx-auto pb-4 pt-4 text-center space-y-2">
          {onOpenCrisis && (
            <button
              onClick={onOpenCrisis}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-400/30 transition-all"
            >
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>24/7 Crisis Support & Lifeline (Trevor Project / 988)</span>
            </button>
          )}

          <p className="text-[11px] text-purple-300/60">
            Q Intelligence • Safe, confidential, inclusive LGBTQ+ platform
          </p>
        </div>

        <LegalFooter />
      </div>
    </div>
  );
};