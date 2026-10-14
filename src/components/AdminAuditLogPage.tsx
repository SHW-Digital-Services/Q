import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

type AuditEvent = { id: string; occurred_at: string; actor_id: string | null; subject_id: string | null; action: string; outcome: string; request_id: string; metadata: Record<string, unknown> | null };
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50';

export default function AdminAuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  async function load(reset = false) {
    reset ? setLoading(true) : setLoadingMore(true);
    setError('');
    try {
      const client = getSupabaseClient();
      const { data } = await client?.auth.getSession() ?? { data: { session: null } };
      if (!data.session) throw new Error('Sign in with an administrator account to view the audit log.');
      const current = reset ? [] : events;
      const last = current.at(-1);
      const params = new URLSearchParams({ limit: '100' });
      if (last) { params.set('beforeTime', last.occurred_at); params.set('beforeId', last.id); }
      const response = await fetch(`/api/v1/admin/audit-log?${params.toString()}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load the audit log.');
      const page = (result.events || []) as AuditEvent[];
      setEvents(reset ? page : [...current, ...page]);
      setHasMore(page.length === 100);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the audit log.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }

  useEffect(() => { void load(true); }, []);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? events.filter((event) => `${event.action} ${event.outcome} ${event.actor_id ?? 'anonymous'} ${event.subject_id ?? ''} ${String(event.metadata?.page ?? '')} ${String(event.metadata?.target ?? '')}`.toLowerCase().includes(term)) : events;
  }, [events, search]);

  return <section className="w-full min-w-0 text-slate-100">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-3 text-xl font-bold"><ClipboardList className="h-6 w-6 text-violet-300"/>Activity and security events</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">The log records page views, clicks, form submissions, selection changes, and server security events. Anonymous visitors use a session-only ID. Typed text, field values, message bodies, email addresses, and IP addresses are not recorded by the activity tracker. Events are retained for up to 400 days.</p></div>
      <button type="button" className={button} onClick={() => void load(true)} disabled={loading}><RefreshCw className="h-4 w-4"/>Refresh</button>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-500/10 p-3 text-rose-200">{error}</p>}
    <label className="mb-4 flex min-h-11 max-w-xl items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3"><Search className="h-4 w-4 shrink-0 text-slate-400"/><span className="sr-only">Filter audit events</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by action, account, page, or control" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none"/></label>
    {loading ? <p role="status" className="py-8 text-sm text-slate-400">Loading audit events…</p> : filtered.length === 0 ? <p className="rounded-xl border border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400">No matching audit events.</p> : <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Page / control</th><th className="px-4 py-3">Result</th></tr></thead><tbody className="divide-y divide-white/5">{filtered.map((event) => <tr key={event.id} className="align-top"><td className="whitespace-nowrap px-4 py-3 text-slate-300">{new Date(event.occurred_at).toLocaleString()}</td><td className="max-w-48 break-all px-4 py-3 text-slate-300" title={event.actor_id ?? undefined}>{event.actor_id ? event.actor_id : `Guest · ${String(event.metadata?.visitorId ?? 'session')}`}</td><td className="px-4 py-3"><span className="font-medium text-slate-100">{event.action}</span><span className="ml-2 text-xs text-slate-500">{event.subject_id ? `subject ${event.subject_id}` : ''}</span></td><td className="max-w-96 break-all px-4 py-3 text-slate-300">{event.metadata?.page ? <>{String(event.metadata.page)}{event.metadata.target ? ` · ${String(event.metadata.target)}` : ''}</> : 'Server action'}</td><td className="px-4 py-3 text-slate-300">{event.outcome}</td></tr>)}</tbody></table></div>}
    {!loading && hasMore && events.length > 0 && <button type="button" className={`${button} mt-4`} disabled={loadingMore} onClick={() => void load(false)}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
  </section>;
}
