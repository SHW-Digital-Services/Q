import React, { useEffect, useRef, useState } from 'react';
import { CrmDraftProvider, clearCrmDrafts } from '../contexts/CrmDraftContext';
import { supportApi } from '../services/support';
import SupportRequests from './SupportRequests';
import type { SupportRequest } from '../shared/support';

export default function SupportAccessPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('access') || '');
  const exchange = useRef<Promise<{ requestId: string }> | null>(null);
  const [requestId, setRequestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ id: new URLSearchParams(window.location.search).get('request') || '', email: '' });
  useEffect(() => {
    let active = true;
    if (token) {
      window.history.replaceState({}, '', '/support');
      // Reuse the exchange under React Strict Mode: a one-use link must not be
      // consumed twice by development effect replay.
      exchange.current ||= supportApi<{ requestId: string }>('/access/exchange', { guest: true, method: 'POST', body: { token } });
    }
    let previous = false; try { previous = Boolean(sessionStorage.getItem('q-support-guest-active')); } catch { /* no recovery */ }
    if (!token && !previous) return;
    setLoading(true);
    const task = exchange.current || supportApi<SupportRequest[]>('/requests', { guest: true }).then(rows => ({ requestId: rows[0]?.id || '' }));
    void task.then(result => {
      if (!active) return;
      setRequestId(result.requestId);
      try { if (result.requestId) sessionStorage.setItem('q-support-guest-active', 'true'); } catch { /* cookie remains valid */ }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to open this support link.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  async function requestAccess(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setNotice('');
    try {
      const result = await supportApi<{ message: string }>('/access', { guest: true, method: 'POST', body: form });
      setNotice(result.message);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to request access.'); }
    finally { setLoading(false); }
  }
  async function close() {
    setLoading(true); setError('');
    try {
      await supportApi('/access/logout', { guest: true, method: 'POST' });
      clearCrmDrafts(`guest-${requestId}`); setRequestId('');
      try { sessionStorage.removeItem('q-support-guest-active'); } catch { /* ignored */ }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to close support access.'); }
    finally { setLoading(false); }
  }
  const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900';
  return <main className="min-h-screen bg-violet-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl space-y-6">
    <header><a href="/" className="text-sm text-violet-700 underline">Q home</a><h1 className="mt-4 text-3xl font-bold">Q Help &amp; Support</h1><p className="mt-2 text-sm text-slate-600">Access a request you submitted while signed out. Keep email access links private.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-rose-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-3 text-emerald-900">{notice}</p>}
    {loading && <p role="status">Please wait…</p>}
    {requestId ? <><button disabled={loading} className="rounded-xl border border-violet-300 p-3 text-sm" onClick={() => void close()}>Close support access on this device</button><CrmDraftProvider key={requestId} userId={`guest-${requestId}`}><SupportRequests guest initialRequestId={requestId} /></CrmDraftProvider></> : <form className="max-w-lg space-y-4 rounded-2xl border border-violet-200 bg-white p-5" onSubmit={requestAccess}><h2 className="text-lg font-bold">Request an email access link</h2><fieldset disabled={loading} className="space-y-4"><label className="block text-sm">Request reference<input required maxLength={36} value={form.id} onChange={event => setForm(current => ({ ...current, id: event.target.value }))} className={control} /></label><label className="block text-sm">Email address used for the request<input required type="email" autoComplete="email" maxLength={320} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className={control} /></label><button type="submit" className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white">Email access link</button></fieldset><p className="text-xs text-slate-600">Links expire after 24 hours and open only one request. Account requests are available after <a href="/app?tab=help" className="text-violet-700 underline">signing in to Q</a>. If you cannot find your reference, contact office@q-ai.online.</p></form>}
    <p className="text-xs text-slate-600">This is product and account support, not an emergency service. No response time is guaranteed.</p>
  </div></main>;
}
