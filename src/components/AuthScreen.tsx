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
  CircleHelp,
  MessageSquareText,
  X,
} from 'lucide-react';
import { AuthUser } from '../types';
import { getSupabaseClient, getSupabaseEnvConfig, mapSupabaseUser, signInWithGoogle } from '../services/supabase';
import { QLogo } from './QLogo';
import { LegalFooter } from './LegalFooter';
import { HelpView } from './HelpView';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthScreenProps {
  onUserSignedIn: (user: AuthUser) => void;
  onOpenCrisis?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onUserSignedIn,
  onOpenCrisis
}) => {
  const { t } = useLanguage();
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
  const [showHelp, setShowHelp] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', category: 'general', subject: '', message: '', website: '' });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<string | null>(null);

  const handleContactRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setContactLoading(true);
    setContactFeedback(null);
    try {
      const response = await fetch('/api/v1/admin/contact-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send your message.');
      setContactFeedback('Your message has been sent to the Q support team.');
      setContact(current => ({ ...current, subject: '', message: '', website: '' }));
    } catch (error: any) {
      setContactFeedback(error.message || 'Unable to send your message.');
    } finally {
      setContactLoading(false);
    }
  };

  const envConfig = getSupabaseEnvConfig();
  const referralCode = new URLSearchParams(window.location.search).get('ref');

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!envConfig.isConfigured) {
      setErrorMessage('Secure account access is temporarily unavailable. Please contact Q support.');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setErrorMessage(err.message || 'Google authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const claimReferral = async (accessToken: string, savedCode?: string) => {
    const code = referralCode || savedCode;
    if (!code) return;
    const response = await fetch('/api/referrals/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ code })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'The referral could not be claimed.');
    }
  };

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
      setErrorMessage('Secure account access is temporarily unavailable. Please contact Q support.');
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
              name: fullName || email.split('@')[0],
              q_privacy_level: 'high',
              ...(referralCode ? { q_referral_code: referralCode.toUpperCase() } : {})
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
              await claimReferral(data.session.access_token);
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
          if (data.session) await claimReferral(data.session.access_token, data.user.user_metadata?.q_referral_code);
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
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-x-hidden bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 p-4 text-white select-none sm:p-6">
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
              <span>{t('signIn')}</span>
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
              <span>{t('createAccount')}</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-950">
              <Database className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Secure Account Access</span>
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

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>{loading ? 'Opening Google...' : mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
              </button>
              <div className="flex items-center gap-3 py-1" aria-hidden="true">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label htmlFor="q-auth-full-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name or Display Alias
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="q-auth-full-name"
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
              <label htmlFor="q-auth-email" className="block text-xs font-bold text-slate-700 mb-1">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="q-auth-email"
                  type="email"
                  required
                  pattern="[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+"
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
                  <label htmlFor="q-auth-password" className="block text-xs font-bold text-slate-700">{t('password')}</label>
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
                      {t('forgotPassword')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="q-auth-password"
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
                    aria-label={showPassword ? 'Hide secret' : 'Show secret'}
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
                <label htmlFor="q-reset-email" className="mb-1 block text-xs font-bold text-slate-700">Email address</label>
                <input
                  id="q-reset-email"
                  type="email"
                  required
                  pattern="[^\\s@]+@(?:[^\\s@.]+\\.)+[^\\s@.]+"
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

      {showHelp && (
        <div role="dialog" aria-modal="true" aria-label="Q Help centre" className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto max-w-5xl rounded-3xl bg-slate-50 p-3 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between px-1"><h2 className="font-black text-slate-900">Q Help centre</h2><button type="button" onClick={() => setShowHelp(false)} aria-label="Close Help centre" className="rounded-full bg-slate-200 p-2 text-slate-700 hover:bg-slate-300"><X className="h-5 w-5" /></button></div>
            <HelpView onOpenCrisis={() => { setShowHelp(false); onOpenCrisis?.(); }} />
          </div>
        </div>
      )}

      {showContact && (
        <div role="dialog" aria-modal="true" aria-labelledby="contact-q-title" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 id="contact-q-title" className="text-lg font-black">Contact Q support</h2><p className="mt-1 text-xs text-slate-500">Your message will enter the secure Q CRM queue for an authorised staff member to answer.</p></div><button type="button" onClick={() => setShowContact(false)} aria-label="Close contact form" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleContactRequest} className="mt-5 space-y-3">
              {contactFeedback && <div className={`rounded-xl border p-3 text-xs font-semibold ${contactFeedback.includes('sent') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{contactFeedback}</div>}
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Name (optional)<input value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium" /></label><label className="text-xs font-bold text-slate-700">Email address<input required type="email" value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium" /></label></div>
              <label className="block text-xs font-bold text-slate-700">What can we help with?<select value={contact.category} onChange={event => setContact({ ...contact, category: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium"><option value="general">General question</option><option value="account">Account</option><option value="billing">Billing</option><option value="privacy">Privacy</option><option value="technical">Technical problem</option><option value="feedback">Feedback</option></select></label>
              <label className="block text-xs font-bold text-slate-700">Subject<input required minLength={3} maxLength={160} value={contact.subject} onChange={event => setContact({ ...contact, subject: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium" /></label>
              <label className="block text-xs font-bold text-slate-700">Message<textarea required minLength={10} maxLength={5000} rows={6} value={contact.message} onChange={event => setContact({ ...contact, message: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium" placeholder="Please avoid passwords, payment details, or highly sensitive personal information." /></label>
              <label className="absolute -left-[10000px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={event => setContact({ ...contact, website: event.target.value })} /></label>
              <button disabled={contactLoading} className="w-full rounded-2xl bg-purple-600 px-4 py-3 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-60">{contactLoading ? 'Sending…' : 'Send to Q support'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Footer Support & Lifeline Link */}
      <div className="w-full z-10">
        <div className="max-w-md mx-auto pb-4 pt-4 text-center space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => setShowHelp(true)} className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30"><CircleHelp className="h-3.5 w-3.5" />{t('help')}</button>
            <button type="button" onClick={() => { setContact(current => ({ ...current, email: current.email || email })); setShowContact(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-100 transition hover:bg-purple-500/30"><MessageSquareText className="h-3.5 w-3.5" />Contact us</button>
          </div>
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
