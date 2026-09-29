import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

export function AdminDeleteUser({ id, email, role, onDeleted }: { id: string; email: string; role: string; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy || confirmation !== email || !window.confirm(`Permanently delete ${email} from Q? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      const { data } = await getSupabaseClient()!.auth.getSession();
      if (!data.session) throw new Error('Sign in as an Admin to delete users.');
      const response = await fetch(`/api/v1/admin/delete-users/${id}`, { method: 'DELETE', cache: 'no-store', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete this user.');
      onDeleted();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete this user.'); } finally { setBusy(false); }
  }
  return <section className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/5 p-4"><h3 className="flex items-center gap-2 font-bold text-rose-100"><Trash2 className="h-4 w-4" /> Delete User · Admin Only</h3><p className="mt-2 text-xs text-slate-300">Permanently removes the Q login and data linked by account deletion rules. Retained operational records may remain. This does not delete Zoho mail or cancel PayPal payments. Resolve any subscription first.</p>{role === 'partner_admin' ? <p className="mt-3 text-xs text-rose-200">Admin accounts are protected. Another Admin must change this account’s role before it can be deleted.</p> : <><label className="mt-3 block text-xs text-slate-300">Type {email} to confirm<input value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-xl border border-rose-300/20 bg-slate-950 px-3 py-2 text-sm text-white" /></label><button disabled={busy || confirmation !== email} onClick={() => void remove()} className="mt-3 min-h-11 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-40">{busy ? 'Deleting…' : 'Delete User permanently'}</button></>}{error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}</section>;
}
