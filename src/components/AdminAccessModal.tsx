import React, { useState } from 'react';
import { Mail, Lock, ShieldCheck, XCircle } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

interface AdminAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminGranted: () => void;
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({ isOpen, onClose, onAdminGranted }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('Supabase is not configured yet.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session?.access_token) {
        throw new Error('Admin session was not created.');
      }

      const response = await fetch('/api/v1/admin/me', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error(payload.error || 'This account is not authorised for admin access.');
      }

      onAdminGranted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to access the admin controls.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
              <ShieldCheck className="h-4 w-4" />
              Admin Access
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">Secure admin sign-in</h2>
            <p className="mt-1 text-sm text-slate-300">Use your authorised staff account to manage users without opening Supabase.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {errorMessage && (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}

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
                placeholder="••••••••"
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
            {loading ? 'Checking access…' : 'Enter admin panel'}
          </button>
        </form>
      </div>
    </div>
  );
};
