import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabase';

type Communication = { id: string; direction: string; channel: string; status: string; sender_email: string | null; recipient_email: string | null; subject: string | null; body: string; created_at: string; accountId?: string; folderId?: string; messageId?: string };

export default function CustomerCommunicationHistory({ userId, existing }: { userId: string; existing: Communication[] }) {
  const [mail, setMail] = useState<Communication[]>([]);
  const [start, setStart] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    (async () => {
      const client = getSupabaseClient();
      const session = client ? (await client.auth.getSession()).data.session : null;
      if (!session) throw new Error('Sign in to view customer emails.');
      const response = await fetch(`/api/comms/customers/${userId}/history?start=${start}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load customer emails from Zoho.');
      if (!controller.signal.aborted) { setMail(current => start === 1 ? data.communications : [...new Map([...current, ...data.communications].map(item => [item.id, item])).values()]); setHasMore(data.hasMore); }
    })().catch(failure => { if (!controller.signal.aborted) setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, start, revision]);
  useEffect(() => {
    if (start !== 1 || loading) return;
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1); };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [start, loading]);
  const items = [...existing, ...mail].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return <div>
    <p className="mt-3 text-xs text-slate-400">Emails are matched to the registered email address and loaded directly from Zoho.</p>
    <button disabled={loading} onClick={() => { setStart(1); setRevision(value => value + 1); }} className="mt-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">Refresh emails</button>
    {loading && <p role="status" className="mt-2 text-xs text-slate-400">Loading email history from Zoho…</p>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{!items.length && !loading && !error ? <p className="text-xs text-slate-400">No communications for this account yet.</p> : items.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
      <div className="flex flex-wrap gap-2 text-[10px] uppercase text-slate-400"><span className={item.direction === 'inbound' ? 'text-sky-300' : 'text-emerald-300'}>{item.direction}</span><span>{item.channel} · {item.status}{item.messageId ? ' · Zoho' : ''}</span><span className="ml-auto">{new Date(item.created_at).toLocaleString()}</span></div>
      <p className="mt-2 text-xs text-slate-300">{item.direction === 'inbound' ? item.sender_email : item.recipient_email}{item.subject ? ` · ${item.subject}` : ''}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{item.body}</p>
      {item.messageId && <a href={`/crm/comms?account=${item.accountId}&folder=${item.folderId}&message=${item.messageId}`} className="mt-2 inline-block text-xs text-purple-300 underline">Open email in Communications</a>}
    </article>)}</div>
    {hasMore && <button disabled={loading} onClick={() => setStart(value => value + 30)} className="mt-3 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">Load older emails</button>}
  </div>;
}
