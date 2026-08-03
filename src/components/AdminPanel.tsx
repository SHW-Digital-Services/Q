import React, { useEffect, useState } from 'react';
import { Settings, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

interface AdminPanelProps {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ enabled, onToggle, onClose }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Direct password reset state
  const [directEmail, setDirectEmail] = useState('');
  const [directResetting, setDirectResetting] = useState(false);
  const [directResult, setDirectResult] = useState<{ email: string; tempPassword?: string; recoveryLink?: string } | null>(null);

  const getAuthHeaders = async () => {
    const supabase = getSupabaseClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session?.access_token) throw new Error('Please sign in before managing password resets.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`
    };
  };

  const parseJsonResponse = async (response: Response) => {
    const text = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`Server response error (${response.status}): ${text.slice(0, 120)}`);
      }
      throw new Error('Received non-JSON response from server.');
    }
    if (!response.ok) {
      throw new Error(payload.error || payload.message || `Server error (${response.status})`);
    }
    return payload;
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    setRequestMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/password-reset-requests', { headers });
      const payload = await parseJsonResponse(response);
      setRequests(payload);
    } catch (error: any) {
      setRequestMessage(error.message || 'Unable to load password reset requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const resetPassword = async (request: any) => {
    setResettingId(request.id);
    setRequestMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/admin/password-reset-requests/${request.id}/reset`, {
        method: 'POST',
        headers
      });
      const payload = await parseJsonResponse(response);
      setRequests((current) => current.map((item) => item.id === request.id ? payload.request : item));
      setRequestMessage(`Temporary password created for ${request.email}: ${payload.tempPassword}`);
    } catch (error: any) {
      setRequestMessage(error.message || 'Unable to issue a temporary password.');
    } finally {
      setResettingId(null);
    }
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmail.trim()) return;
    setDirectResetting(true);
    setRequestMessage(null);
    setDirectResult(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/direct-password-reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: directEmail.trim() })
      });
      const payload = await parseJsonResponse(response);
      setDirectResult({
        email: payload.email,
        tempPassword: payload.tempPassword,
        recoveryLink: payload.recoveryLink
      });
      setDirectEmail('');
    } catch (error: any) {
      setRequestMessage(error.message || 'Unable to reset password.');
    } finally {
      setDirectResetting(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
              <ShieldCheck className="h-4 w-4" />
              Admin Controls
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">Launch experience toggle</h2>
            <p className="mt-1 text-sm text-slate-300">Switch the public landing experience between the waitlist page and the new launch page.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Enable new launch landing page</p>
              <p className="mt-1 text-sm text-slate-400">When on, visitors see the launch-style landing page. When off, the waitlist landing page is shown.</p>
            </div>
            <button
              type="button"
              onClick={() => onToggle(!enabled)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${enabled ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Current status: {enabled ? 'New launch landing page enabled' : 'Waitlist landing page enabled'}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Direct password reset</p>
              <p className="mt-1 text-sm text-slate-400">Enter any user's email to instantly issue a temporary password and reset link.</p>
            </div>
          </div>

          <form onSubmit={handleDirectPasswordReset} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={directResetting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {directResetting ? 'Resetting…' : 'Issue temp password'}
            </button>
          </form>

          {directResult && (
            <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 space-y-1.5">
              <p className="font-semibold text-emerald-100">Password reset for {directResult.email}:</p>
              {directResult.tempPassword && (
                <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-emerald-400/20">
                  <span className="font-mono text-emerald-300">Temp Password: {directResult.tempPassword}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(directResult.tempPassword!)}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              )}
              {directResult.recoveryLink && (
                <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-emerald-400/20">
                  <span className="truncate font-mono text-[11px] text-slate-300">Link: {directResult.recoveryLink}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(directResult.recoveryLink!)}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:underline shrink-0"
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Password reset requests</p>
              <p className="mt-1 text-sm text-slate-400">Review contact requests from the login page and issue a temporary password.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Refresh requests"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {requestMessage && (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              {requestMessage}
            </div>
          )}

          {loadingRequests ? (
            <div className="mt-4 text-sm text-slate-400">Loading requests…</div>
          ) : requests.length === 0 ? (
            <div className="mt-4 text-sm text-slate-400">No password reset requests submitted yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{request.email}</p>
                      <p className="mt-1 text-xs text-slate-400">{request.message || 'No details supplied.'}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{request.status}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void resetPassword(request)}
                      disabled={resettingId === request.id}
                      className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-60 shrink-0"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {resettingId === request.id ? 'Resetting…' : request.status === 'reset' ? 'Reset again' : 'Reset password'}
                    </button>
                  </div>
                  {request.tempPassword && (
                    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">Temp password: {request.tempPassword}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(request.tempPassword)}
                          className="font-bold text-emerald-400 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
