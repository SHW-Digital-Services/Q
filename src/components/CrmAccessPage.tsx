import React, { FormEvent, useState } from 'react';
import { ArrowLeft, Lock, Mail, ShieldCheck } from 'lucide-react';
import { crmMicrosoftSsoDeniedKey, crmMicrosoftSsoPendingKey, getSupabaseClient, mapSupabaseUser, signInWithMicrosoftForCrm } from '../services/supabase';
import { AuthUser } from '../types';
import { QLogo } from './QLogo';

export function CrmAccessPage({ onUserSignedIn }: { onUserSignedIn: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordSignIn, setShowPasswordSignIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    if (window.sessionStorage.getItem(crmMicrosoftSsoDeniedKey) === '1') {
      window.sessionStorage.removeItem(crmMicrosoftSsoDeniedKey);
      return 'This Microsoft account does not have an authorised Staff or Admin role for the CRM.';
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has('error') || params.has('error_description')) {
      window.sessionStorage.removeItem(crmMicrosoftSsoPendingKey);
      window.history.replaceState({}, '', window.location.pathname);
      return 'Microsoft sign-in was cancelled or could not be completed.';
    }
    return null;
  });

  const handleMicrosoftSignIn = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await signInWithMicrosoftForCrm();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to sign in with Microsoft.');
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('Secure staff access is temporarily unavailable.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session?.access_token || !data.user) throw new Error('Staff session was not created.');

      const response = await fetch('/api/v1/admin/me', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error(payload.error || 'This account is not authorised for CRM access.');
      }

      onUserSignedIn(mapSupabaseUser(data.user));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to access the CRM.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="q-dark-surface min-h-dvh bg-slate-950 px-4 py-[max(2rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Public site
        </a>
        <section className="rounded-3xl border border-white/15 bg-white/5 p-4 shadow-2xl sm:p-6">
          <div className="flex items-center gap-3">
            <QLogo size="sm" />
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
                <ShieldCheck className="h-4 w-4" />
                Staff CRM
              </div>
              <h1 className="mt-1 text-2xl font-black">Q Customer Operations</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Sign in with an authorised staff account to manage customers, subscriptions, content and support activity.
          </p>

          <button
            type="button"
            onClick={() => void handleMicrosoftSignIn()}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
          >
            <span aria-hidden="true" className="grid h-4 w-4 grid-cols-2 gap-[2px]"><span className="bg-[#f25022]" /><span className="bg-[#7fba00]" /><span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" /></span>
            {loading ? 'Connecting to Microsoft...' : 'Sign in with Microsoft'}
          </button>
          <button
            type="button"
            onClick={() => setShowPasswordSignIn((visible) => !visible)}
            aria-expanded={showPasswordSignIn}
            aria-controls="crm-password-sign-in"
            className="mx-auto mt-4 block text-sm font-medium text-purple-200 underline decoration-purple-200/50 underline-offset-4 transition hover:text-white"
          >
            {showPasswordSignIn ? 'Hide email and password sign-in' : 'Sign in another way'}
          </button>
          {errorMessage && (
            <div role="alert" className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}

          {showPasswordSignIn && <form id="crm-password-sign-in" onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block text-sm text-slate-200">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  className="w-full border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  required
                />
              </div>
            </label>

            <label className="block text-sm text-slate-200">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Password</span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <Lock className="h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="w-full border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-60"
            >
              {loading ? 'Checking access...' : 'Enter CRM'}
            </button>
          </form>}
        </section>
      </div>
    </main>
  );
}
