import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, RefreshCw, Send, Database, CreditCard } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

type Health = { status?: string; services?: Record<string, string>; timestamp?: string };
type HubEvent = { id: string; type: string; payload: unknown; created_at: string };
type SupabaseDiagnostics = { logs: Record<string, unknown>[]; metrics: string; checkedAt: number };
type PayPalDiagnostics = {
  events: { id: string; event_type: string; status: string; attempt_count: number; last_error_code: string | null; processed_at: string }[];
  payments: { provider_transaction_id: string | null; status: string; payment_type: string; amount_minor: number; currency: string; occurred_at: string }[];
  metrics: { days: number; webhooks: { total: number; completed: number; failed: number }; payments: { total: number; completed: number; failed: number; refunded: number } };
  checkedAt: number;
};
type BetterStackStatusPage = {
  data?: { attributes?: { company_name?: string; custom_domain?: string | null; subdomain?: string; aggregate_state?: string } };
};

const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('en-GB') : 'Unknown';

export default function ItHubAdmin() {
  const [health, setHealth] = useState<Health | null>(null);
  const [statusPage, setStatusPage] = useState<BetterStackStatusPage | null>(null);
  const [events, setEvents] = useState<HubEvent[]>([]);
  const [supabaseDiagnostics, setSupabaseDiagnostics] = useState<SupabaseDiagnostics | null>(null);
  const [supabaseError, setSupabaseError] = useState('');
  const [paypalDiagnostics, setPaypalDiagnostics] = useState<PayPalDiagnostics | null>(null);
  const [paypalError, setPaypalError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const client = getSupabaseClient();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    if (!data.session) throw new Error('Sign in as an Admin to open IT Hub.');
    const response = await fetch(path, {
      ...options,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', ...options?.headers }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The IT Hub request failed.');
    return result;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const healthResult = await fetch('/api/health', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok && !body.status) throw new Error(body.error || 'The Q health check reported a problem.');
      return { ...(body as Health), status: body.status || (response.ok ? 'ok' : 'down') };
    }).catch(reason => {
      setHealth({ status: 'down' });
      setError(reason instanceof Error ? reason.message : 'Unable to load Q health.');
      return null;
    });
    if (healthResult) setHealth(healthResult);

    const [eventsResult, pageResult, supabaseResult, paypalResult] = await Promise.allSettled([
      request('/api/v1/admin/it-hub/events'),
      request('/api/v1/admin/it-hub/status-page'),
      request('/api/v1/admin/it-hub/supabase-diagnostics'),
      request('/api/v1/admin/it-hub/paypal-diagnostics')
    ]);
    if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value.events ?? []);
    else setError(eventsResult.reason instanceof Error ? eventsResult.reason.message : 'Unable to load IT Hub events.');
    if (pageResult.status === 'fulfilled') setStatusPage(pageResult.value.statusPage);
    else setError(current => current || (pageResult.reason instanceof Error ? pageResult.reason.message : 'Unable to load BetterStack status.'));
    if (supabaseResult.status === 'fulfilled') { setSupabaseDiagnostics(supabaseResult.value); setSupabaseError(''); }
    else { setSupabaseDiagnostics(null); setSupabaseError(supabaseResult.reason instanceof Error ? supabaseResult.reason.message : 'Unable to load Supabase diagnostics.'); }
    if (paypalResult.status === 'fulfilled') { setPaypalDiagnostics(paypalResult.value); setPaypalError(''); }
    else { setPaypalDiagnostics(null); setPaypalError(paypalResult.reason instanceof Error ? paypalResult.reason.message : 'Unable to load PayPal diagnostics.'); }
    setLoading(false);
  }, [request]);

  const statusAttributes = statusPage?.data?.attributes;
  const statusPageUrl = statusAttributes?.custom_domain
    ? `https://${statusAttributes.custom_domain}`
    : statusAttributes?.subdomain
      ? `https://${statusAttributes.subdomain}.betteruptime.com`
      : undefined;

  useEffect(() => { void refresh(); }, [refresh]);

  const createIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    try {
      await request('/api/v1/admin/it-hub/incidents', {
        method: 'POST',
        body: JSON.stringify({ title, details })
      });
      setTitle('');
      setDetails('');
      setNotice('Incident created in BetterStack.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the incident.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="mt-6 space-y-6" aria-label="IT Hub administration">
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{notice}</p>}

    <div className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="flex items-center gap-2 font-semibold text-white"><Activity className="h-4 w-4 text-cyan-300" />Q service health</h2><p className="mt-1 text-xs text-slate-400">Last checked {dateLabel(health?.timestamp)}</p></div>
          <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh IT Hub status" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 text-slate-200 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm"><CheckCircle2 className={`h-4 w-4 ${health?.status === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`} />Overall: <strong>{health?.status === 'ok' ? 'Healthy' : health ? 'Needs attention' : 'Loading'}</strong></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{Object.entries(health?.services ?? {}).map(([service, state]) => <div key={service} className="rounded-xl bg-slate-950/70 p-3"><dt className="text-xs capitalize text-slate-400">{service}</dt><dd className={`mt-1 font-semibold ${state === 'up' ? 'text-emerald-200' : state === 'not_configured' ? 'text-amber-200' : 'text-rose-200'}`}>{state}</dd></div>)}</dl>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold text-white">BetterStack status page</h2>
        {statusPage ? <><p className="mt-2 text-sm text-slate-300">{statusAttributes?.company_name || 'Status page connected'}</p>{statusPageUrl ? <a href={statusPageUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-cyan-300 underline">{statusPageUrl}</a> : <p className="mt-1 text-xs text-slate-400">Connected through BetterStack API</p>}{statusAttributes?.aggregate_state && <p className="mt-2 text-xs capitalize text-slate-400">Current state: {statusAttributes.aggregate_state}</p>}</> : <p className="mt-2 text-sm text-slate-400">No status page data is available yet.</p>}
      </article>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-white"><Database className="h-4 w-4 text-emerald-300" />Supabase logs and metrics</h2><p className="mt-1 text-xs text-slate-400">Recent project logs and live Prometheus metrics. Logs cover the last hour.</p></div><span className="text-xs text-slate-500">{supabaseDiagnostics ? dateLabel(new Date(supabaseDiagnostics.checkedAt).toISOString()) : ''}</span></div>
        {supabaseError ? <p role="alert" className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100">{supabaseError}</p> : !supabaseDiagnostics ? <p role="status" className="mt-4 text-sm text-slate-400">Loading Supabase diagnostics…</p> : <>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-200"><span className="rounded-full bg-slate-900 px-3 py-1">{supabaseDiagnostics.logs.length} recent log entries</span><span className="rounded-full bg-slate-900 px-3 py-1">Metrics feed connected</span></div>
          <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-cyan-200">Recent project logs</summary>
            {supabaseDiagnostics.logs.length ? <ul className="mt-2 max-h-80 divide-y divide-white/10 overflow-auto rounded-xl bg-slate-950/70 px-3">{supabaseDiagnostics.logs.map((item, index) => <li key={String(item.id ?? index)} className="py-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{String(item.source ?? 'Supabase')}</span><span>{dateLabel(String(item.timestamp ?? ''))}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-200">{String(item.event_message ?? JSON.stringify(item))}</p></li>)}</ul> : <p className="mt-2 text-xs text-slate-400">No logs were returned for the last hour.</p>}
          </details>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-cyan-200">Prometheus metrics</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/70 p-3 text-[10px] leading-4 text-slate-300">{supabaseDiagnostics.metrics || 'No metrics were returned.'}</pre></details>
        </>}
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-white"><CreditCard className="h-4 w-4 text-sky-300" />PayPal logs and metrics</h2><p className="mt-1 text-xs text-slate-400">Webhook processing and payment activity from the last 30 days.</p></div><span className="text-xs text-slate-500">{paypalDiagnostics ? dateLabel(new Date(paypalDiagnostics.checkedAt).toISOString()) : ''}</span></div>
        {paypalError ? <p role="alert" className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100">{paypalError}</p> : !paypalDiagnostics ? <p role="status" className="mt-4 text-sm text-slate-400">Loading PayPal diagnostics…</p> : <>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{[['Payments', paypalDiagnostics.metrics.payments.total], ['Completed', paypalDiagnostics.metrics.payments.completed], ['Failed', paypalDiagnostics.metrics.payments.failed], ['Refunded', paypalDiagnostics.metrics.payments.refunded], ['Webhooks', paypalDiagnostics.metrics.webhooks.total], ['Webhook failures', paypalDiagnostics.metrics.webhooks.failed]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-950/70 p-3"><div className="text-slate-400">{label}</div><strong className="mt-1 block text-lg text-white">{value}</strong></div>)}</div>
          <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-cyan-200">Recent webhook events ({paypalDiagnostics.events.length})</summary>{paypalDiagnostics.events.length ? <ul className="mt-2 max-h-64 divide-y divide-white/10 overflow-auto rounded-xl bg-slate-950/70 px-3">{paypalDiagnostics.events.map(item => <li key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><strong className="text-slate-200">{item.event_type}</strong><span className={item.status === 'completed' ? 'text-emerald-300' : item.status === 'failed' ? 'text-rose-300' : 'text-amber-300'}>{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{dateLabel(item.processed_at)} · {item.attempt_count} attempt{item.attempt_count === 1 ? '' : 's'}{item.last_error_code ? ` · ${item.last_error_code}` : ''}</p></li>)}</ul> : <p className="mt-2 text-xs text-slate-400">No PayPal webhook events found.</p>}</details>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-cyan-200">Recent payment records ({paypalDiagnostics.payments.length})</summary>{paypalDiagnostics.payments.length ? <ul className="mt-2 max-h-64 divide-y divide-white/10 overflow-auto rounded-xl bg-slate-950/70 px-3">{paypalDiagnostics.payments.map((item, index) => <li key={`${item.provider_transaction_id ?? 'payment'}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-xs"><span className="text-slate-200">{item.payment_type} · {item.status}</span><span className="text-slate-400">{(item.amount_minor / 100).toFixed(2)} {item.currency} · {dateLabel(item.occurred_at)}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-400">No PayPal payment records found.</p>}</details>
        </>}
      </article>
    </div>

    <form onSubmit={createIncident} className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-semibold text-white">Create a BetterStack incident</h2>
      <p className="mt-1 text-xs leading-5 text-slate-400">Incident creation uses the configured BetterStack account. Details are also recorded in the IT Hub event history.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-200">Incident title<input required minLength={3} maxLength={180} value={title} onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white" /></label>
        <label className="text-xs text-slate-200">Details<textarea maxLength={5000} value={details} onChange={event => setDetails(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white" /></label>
      </div>
      <button disabled={saving} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{saving ? 'Creating incident…' : 'Create incident'}</button>
    </form>

    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Recent IT Hub events</h2><p className="mt-1 text-xs text-slate-400">Newest event activity stored by Q.</p></div><span className="text-xs text-slate-400">{events.length} shown</span></div>
      {events.length ? <ul className="mt-4 divide-y divide-white/10">{events.map(item => <li key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm capitalize text-slate-100">{item.type.replace(/_/g, ' ')}</strong><time className="text-xs text-slate-400">{dateLabel(item.created_at)}</time></div><details className="mt-2 text-xs text-slate-400"><summary className="cursor-pointer">Event details</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3">{JSON.stringify(item.payload, null, 2)}</pre></details></li>)}</ul> : <p className="mt-4 rounded-xl bg-slate-950/60 p-4 text-sm text-slate-400">No IT Hub events found.</p>}
    </article>
  </section>;
}
