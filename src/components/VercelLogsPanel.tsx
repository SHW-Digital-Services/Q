import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

type VercelLog = {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  domain: string;
  requestMethod: string;
  requestPath: string;
  responseStatusCode: number | null;
  source: string;
  deploymentUrl: string;
};

const counts = [10, 30, 50, 100] as const;

export default function VercelLogsPanel() {
  const [limit, setLimit] = useState<number>(10);
  const [logs, setLogs] = useState<VercelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const session = (await getSupabaseClient()?.auth.getSession())?.data.session;
      if (!session) throw new Error('Sign in again to view Vercel logs.');
      const response = await fetch(`/api/v1/admin/vercel-logs?limit=${limit}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
        signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load Vercel logs.');
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setUpdatedAt(Date.now());
      setError('');
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Unable to load Vercel logs.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(controller.signal), 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  return <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5" aria-labelledby="vercel-log-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 id="vercel-log-title" className="text-lg font-semibold text-white">Vercel runtime logs</h2>
        <p className="mt-1 text-sm text-slate-400">Production logs refresh automatically every 15 seconds.</p>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="vercel-log-count" className="text-sm text-slate-300">Show</label>
        <select id="vercel-log-count" value={limit} onChange={event => setLimit(Number(event.target.value))} className="min-h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white">
          {counts.map(count => <option key={count} value={count}>{count} logs</option>)}
        </select>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {updatedAt && <p className="mt-3 text-xs text-slate-500">Last checked {new Date(updatedAt).toLocaleTimeString('en-GB')}</p>}
    {loading && !logs.length ? <p role="status" className="mt-5 text-sm text-slate-400">Loading Vercel logs…</p> : !logs.length ? <p className="mt-5 text-sm text-slate-400">{error ? 'Logs could not be loaded.' : 'No runtime logs were found for recent production deployments.'}</p> : <ol className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
      {logs.map(log => <li key={log.id} className="grid gap-2 bg-slate-950/60 p-4 sm:grid-cols-[150px_minmax(0,1fr)]">
        <time className="text-xs text-slate-500" dateTime={new Date(log.timestamp).toISOString()}>{new Date(log.timestamp).toLocaleString('en-GB')}</time>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 font-semibold ${log.level === 'error' || log.level === 'fatal' ? 'bg-rose-500/15 text-rose-200' : log.level === 'warning' ? 'bg-amber-500/15 text-amber-200' : 'bg-slate-700 text-slate-200'}`}>{log.level || 'info'}</span>
            {log.responseStatusCode !== null && <span className="text-slate-400">HTTP {log.responseStatusCode}</span>}
            {log.requestMethod && <span className="text-slate-400">{log.requestMethod}</span>}
            {log.requestPath && <span className="break-all font-mono text-violet-200">{log.requestPath}</span>}
          </div>
          {log.message && <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-200">{log.message}</pre>}
          <p className="mt-2 break-all text-xs text-slate-500">{log.domain} · {log.source} · {log.deploymentUrl}</p>
        </div>
      </li>)}
    </ol>}
  </section>;
}
