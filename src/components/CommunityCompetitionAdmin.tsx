import React, { useEffect, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

function previousMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function CommunityCompetitionAdmin() {
  const [month, setMonth] = useState(previousMonth);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [payload, setPayload] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const request = async (path: string, init?: RequestInit) => {
    const client = getSupabaseClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session?.access_token) throw new Error('Sign in to manage the competition.');
    const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${session.access_token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Competition request failed.');
    return data;
  };

  const refresh = async () => {
    try { setCompetitions((await request('/api/v1/admin/community-competition')).competitions ?? []); }
    catch (error: any) { setMessage(error.message || 'Unable to load competition history.'); }
  };

  useEffect(() => { void refresh(); }, []);

  const run = async (action: 'preview' | 'award') => {
    if (action === 'award' && !window.confirm(`Award the ${month} competition and send its newsletter to the configured Slack channel? Winner awards cannot be undone.`)) return;
    setBusy(true); setMessage('');
    try {
      const result = await request('/api/v1/admin/community-competition', { method: 'POST', body: JSON.stringify({ action, month }) });
      setPayload(result.payload);
      setMessage(action === 'preview' ? 'Preview generated. No winners were awarded.' : 'Winners awarded and newsletter delivered.');
      await refresh();
    } catch (error: any) { setMessage(error.message || 'Unable to manage this competition.'); await refresh(); }
    finally { setBusy(false); }
  };

  return <section className="mt-6 space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
    <div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-amber-300"/><div><h2 className="font-bold text-white">Community competition</h2><p className="mt-1 text-sm text-slate-400">Preview monthly finalists, award winners, and deliver the newsletter.</p></div></div>
    <div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-300">Competition month<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"/></label><button type="button" disabled={busy || !month} onClick={() => void run('preview')} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Working…' : 'Generate preview'}</button><button type="button" disabled={busy || !month} onClick={() => void run('award')} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Award winners &amp; send newsletter</button><button type="button" disabled={busy} onClick={() => void refresh()} aria-label="Refresh competition history" className="rounded-xl border border-white/10 p-2 text-slate-300 disabled:opacity-50"><RefreshCw className="h-4 w-4"/></button></div>
    <p className="text-xs leading-5 text-slate-400">The preview shows the five eligible top-liked posts, the random selection, and the most-liked winner. Awarding records both winners and grants six months of Premium to the most-liked winner before sending the monthly newsletter. A winner cannot win the most-liked award again for 12 months.</p>
    {message && <p role="status" className="rounded-xl bg-slate-900 p-3 text-sm text-slate-200">{message}</p>}
    {payload && <div className="grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-slate-900 p-4"><h3 className="font-bold text-white">Eligible top five · {payload.month}</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-300">{payload.topContributions?.map((item: any, index: number) => <li key={`${item.url}-${index}`}><a href={item.url} target="_blank" rel="noreferrer" className="text-violet-200 underline">{item.title}</a> · {item.authorAlias} · {item.likes} likes</li>)}</ol></div><div className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-300"><h3 className="font-bold text-white">Selections</h3><p className="mt-2">Random top-five: {payload.randomTopFiveWinner?.authorAlias} — {payload.randomTopFiveWinner?.title}</p><p className="mt-2">Most liked: {payload.mostLikedWinner?.authorAlias} — {payload.mostLikedWinner?.title} (six months Premium)</p></div></div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="p-2">Month</th><th>Status</th><th>Awarded</th><th>Delivered</th></tr></thead><tbody>{competitions.map(item => <tr key={item.id} className="border-t border-white/10 text-slate-300"><td className="p-2">{String(item.award_month).slice(0, 7)}</td><td>{item.status}{item.delivery_error ? ` · ${item.delivery_error}` : ''}</td><td>{item.awarded_at ? new Date(item.awarded_at).toLocaleString() : '—'}</td><td>{item.delivered_at ? new Date(item.delivered_at).toLocaleString() : '—'}</td></tr>)}{!competitions.length && <tr><td colSpan={4} className="p-3 text-slate-500">No competition history is available.</td></tr>}</tbody></table></div>
  </section>;
}
