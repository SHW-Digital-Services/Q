import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, Plus, RefreshCw, Webhook } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

interface Endpoint {
  id: string; name: string; webhook_type: string; integration_address: string;
  url: string; active: boolean; token_prefix: string; last_received_at: string | null;
}
interface WebhookEvent {
  id: string; endpoint_id: string; event_type: string; email: string | null;
  status: 'received' | 'reviewed'; received_at: string; payload?: unknown;
}
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('en-GB') : 'No events yet';

export function BrevoWebhookAdmin() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [dashboard, setDashboard] = useState<{ total: number; awaitingReview: number; reviewed: number; today: number; updatedAt: string } | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ eventType: '', email: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [name, setName] = useState('');
  const [webhookType, setWebhookType] = useState('transactional');
  const [endpointFilter, setEndpointFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [secret, setSecret] = useState<{ endpoint: Endpoint; token: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const eventRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const client = getSupabaseClient();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    if (!data.session) throw new Error('Sign in as Admin to manage webhooks.');
    const response = await fetch(`/api/v1/admin/brevo-webhooks${path}`, { method, cache: 'no-store', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to manage Brevo webhooks.');
    return result;
  };
  const loadDashboard = async () => {
    try { setDashboard(await request('/dashboard')); }
    catch (error) { setDashboard(null); setMessage(error instanceof Error ? error.message : 'Unable to load dashboard.'); }
  };
  const loadEndpoints = async () => {
    try { setEndpoints((await request('/endpoints')).endpoints); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load endpoints.'); }
  };
  const loadEvents = async (append = false) => {
    const requestId = ++eventRequestId.current; setLoading(true);
    try {
      const query = new URLSearchParams({ ...appliedFilters, endpointId: endpointFilter, status: statusFilter, offset: String(append ? events.length : 0) });
      const result = await request(`/events?${query}`);
      if (requestId !== eventRequestId.current) return;
      setEvents((current) => append ? [...current, ...result.events.filter((event: WebhookEvent) => !current.some((item) => item.id === event.id))] : result.events);
      setHasMore(result.hasMore); setTotal(result.total);
    } catch (error) { if (requestId === eventRequestId.current) setMessage(error instanceof Error ? error.message : 'Unable to load events.'); }
    finally { if (requestId === eventRequestId.current) setLoading(false); }
  };
  useEffect(() => { void loadEndpoints(); void loadDashboard(); }, []);
  useEffect(() => {
    setEvents([]); setTotal(0); setHasMore(false); setSelectedEvent(null); detailRequestId.current += 1;
    void loadEvents();
    return () => { eventRequestId.current += 1; };
  }, [endpointFilter, statusFilter, appliedFilters]);
  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setMessage(`${label} copied.`); }
    catch { setMessage(`Unable to copy ${label.toLowerCase()}. Select the text and copy it manually.`); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await request('/endpoints', 'POST', { name, webhookType });
      setEndpoints((current) => [result.endpoint, ...current]); setSecret(result); setName('');
      setMessage('Endpoint created. Copy the secret and configure the webhook in Brevo.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create endpoint.'); }
    finally { setBusy(false); }
  };
  const changeEndpoint = async (endpoint: Endpoint, rotate = false) => {
    if (rotate && !window.confirm(`Rotate the secret for ${endpoint.name}? The previous secret will stop working. Update the authentication token in Brevo afterwards.`)) return;
    setBusy(true); setMessage('');
    try {
      const result = await request(`/endpoints/${endpoint.id}${rotate ? '/rotate' : ''}`, rotate ? 'POST' : 'PATCH', rotate ? {} : { active: !endpoint.active });
      setEndpoints((current) => current.map((item) => item.id === endpoint.id ? result.endpoint : item));
      if (rotate) setSecret(result);
      setMessage(rotate ? 'New secret generated. Update the token in Brevo.' : result.endpoint.active ? 'Webhook receiving enabled.' : 'Webhook receiving disabled. Stored events are retained.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update endpoint.'); }
    finally { setBusy(false); }
  };
  const viewEvent = async (event: WebhookEvent) => {
    const requestId = ++detailRequestId.current;
    try { const result = await request(`/events/${event.id}`); if (requestId === detailRequestId.current) setSelectedEvent(result.event); }
    catch (error) { if (requestId === detailRequestId.current) setMessage(error instanceof Error ? error.message : 'Unable to view event.'); }
  };
  const review = async (event: WebhookEvent) => {
    setBusy(true);
    try {
      const status = event.status === 'reviewed' ? 'received' : 'reviewed';
      const result = await request(`/events/${event.id}`, 'PATCH', { status });
      setEvents((current) => current.map((item) => item.id === event.id ? result.event : item).filter((item) => statusFilter === 'all' || item.status === statusFilter));
      setSelectedEvent((current) => current?.id === event.id ? { ...current, ...result.event } : current);
      void loadDashboard(); void loadEvents();
      setMessage(status === 'reviewed' ? 'Event marked reviewed.' : 'Event returned to received.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to review event.'); }
    finally { setBusy(false); }
  };
  const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white';
  return <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5" aria-labelledby="brevo-webhooks-heading">
    <div className="flex items-center justify-between gap-3"><h2 id="brevo-webhooks-heading" className="flex items-center gap-2 font-bold text-white"><Webhook className="h-5 w-5 text-cyan-300" />Brevo events dashboard</h2><button type="button" disabled={loading} onClick={() => { setMessage(''); void loadEndpoints(); void loadEvents(); void loadDashboard(); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh</button></div>
    <p className="mt-2 text-sm text-slate-400">Receive and store Brevo events in an Admin-only inbox. All events received by Q are available below, including events from disabled endpoints. Summary totals cover all stored events; filters apply to the event list.</p>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['All stored events', dashboard?.total], ['Awaiting review', dashboard?.awaitingReview], ['Reviewed', dashboard?.reviewed], ['Received today (UTC)', dashboard?.today]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-cyan-200">{value === undefined ? '--' : Number(value).toLocaleString('en-GB')}</p></div>)}</div>
    {dashboard && <p className="mt-2 text-xs text-slate-500">Last refreshed: {formatDate(dashboard.updatedAt)}</p>}
    <form onSubmit={create} className="mt-4 grid gap-3 md:grid-cols-[1fr_14rem_auto]"><label className="text-xs text-slate-200">Endpoint name<input required minLength={3} maxLength={120} disabled={busy} value={name} onChange={(event) => setName(event.target.value)} placeholder="Brevo email delivery" className={inputClass} /></label><label className="text-xs text-slate-200">Event source<select disabled={busy} value={webhookType} onChange={(event) => setWebhookType(event.target.value)} className={inputClass}><option value="transactional">Transactional</option><option value="marketing">Marketing</option><option value="other">Other Brevo events</option></select></label><button disabled={busy} className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Create endpoint</button></form>
    {message && <p role="status" className="mt-4 rounded-xl bg-cyan-500/10 p-3 text-sm text-cyan-100">{message}</p>}
    {secret && <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4"><h3 className="font-bold text-amber-100">Copy the secret for {secret.endpoint.name}</h3><p className="mt-2 text-xs text-amber-100/80">Q stores only its hash. This secret cannot be retrieved after leaving this page. Set Brevo's authentication method to Bearer and paste this token.</p><div className="mt-3 flex items-center gap-2"><code className="min-w-0 flex-1 select-all break-all rounded-lg bg-slate-950 p-3 text-xs text-white">{secret.token}</code><button type="button" aria-label="Copy webhook secret" onClick={() => void copy(secret.token, 'Secret')} className="rounded-lg p-3 text-white"><Copy className="h-4 w-4" /></button></div><button type="button" onClick={() => setSecret(null)} className="mt-3 text-xs font-bold text-amber-100 underline">Dismiss secret</button></div>}
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{endpoints.map((endpoint) => <article key={endpoint.id} className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/70 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-white">{endpoint.name}</h3><p className="mt-1 text-xs text-slate-400">{endpoint.webhook_type} · {endpoint.active ? 'Enabled' : 'Disabled'}</p></div><button type="button" disabled={busy} onClick={() => void changeEndpoint(endpoint)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{endpoint.active ? 'Disable' : 'Enable'}</button></div>
      <p className="mt-4 text-xs font-bold text-slate-300">Receiving URL — paste into Brevo</p><div className="mt-2 flex items-start gap-2"><code className="min-w-0 flex-1 select-all break-all text-xs leading-5 text-cyan-200">{endpoint.url}</code><button type="button" aria-label={`Copy receiving URL for ${endpoint.name}`} onClick={() => void copy(endpoint.url, 'Receiving URL')} className="rounded-lg p-2 text-white"><Copy className="h-4 w-4" /></button></div>
      <p className="mt-4 text-xs font-bold text-slate-300">Integration address</p><div className="mt-2 flex items-start gap-2"><code className="min-w-0 flex-1 select-all break-all text-xs leading-5 text-cyan-200">{endpoint.integration_address}</code><button type="button" aria-label={`Copy integration address for ${endpoint.name}`} onClick={() => void copy(endpoint.integration_address, 'Integration address')} className="rounded-lg p-2 text-white"><Copy className="h-4 w-4" /></button></div><p className="mt-2 text-xs leading-5 text-slate-500">This is an identifier, not an email inbox. Brevo sends events to the HTTPS receiving URL above.</p>
      <p className="mt-4 text-xs text-slate-400">Last received: {formatDate(endpoint.last_received_at)}</p><button type="button" disabled={busy} onClick={() => void changeEndpoint(endpoint, true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50"><KeyRound className="h-4 w-4" />Rotate secret</button>
    </article>)}</div>
    {endpoints.length === 0 && <p className="mt-4 text-sm text-slate-400">Create an endpoint to connect Brevo.</p>}
    <details className="mt-5 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm font-bold text-white">Brevo setup</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300"><li>Create an endpoint here and copy its receiving URL and secret.</li><li>In Brevo, create an outbound webhook for the events you want to receive.</li><li>Set the URL to Q's receiving URL and configure Bearer token authentication using the secret.</li><li>Send a Brevo event, then refresh this inbox. Delivery events, contact changes and unsubscribe events are stored for Admin review.</li></ol><a href="https://developers.brevo.com/docs/secured-webhooks" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-cyan-200 underline">Brevo webhook authentication guide</a></details>
    <div className="mt-7 flex flex-wrap items-end gap-3"><h3 className="mr-auto text-lg font-bold text-white">Stored events</h3><label className="text-xs text-slate-300">Endpoint<select value={endpointFilter} onChange={(event) => setEndpointFilter(event.target.value)} className={inputClass}><option value="">All endpoints</option>{endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}</option>)}</select></label><label className="text-xs text-slate-300">Review status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="all">All events</option><option value="received">Received</option><option value="reviewed">Reviewed</option></select></label></div>
    <form onSubmit={(event) => { event.preventDefault(); setMessage(''); setAppliedFilters({ ...filters }); }} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs text-slate-300">Event type (exact)<input value={filters.eventType} maxLength={120} onChange={(event) => setFilters({ ...filters, eventType: event.target.value })} placeholder="e.g. delivered or opened" className={inputClass} /></label>
      <label className="text-xs text-slate-300">Recipient email (exact)<input value={filters.email} maxLength={320} onChange={(event) => setFilters({ ...filters, email: event.target.value })} placeholder="name@example.com" className={inputClass} /></label>
      <label className="text-xs text-slate-300">Received from (UTC)<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className={inputClass} /></label>
      <label className="text-xs text-slate-300">Received through (UTC)<input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className={inputClass} /></label>
      <div className="flex items-end gap-2"><button disabled={loading} className="rounded-xl bg-cyan-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Apply filters</button><button type="button" onClick={() => { const empty = { eventType: '', email: '', from: '', to: '' }; setFilters(empty); setAppliedFilters(empty); setEndpointFilter(''); setStatusFilter('all'); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white">Clear</button></div>
    </form>
    <p className="mt-3 text-xs text-slate-400">{loading ? 'Updating event list...' : `Showing ${events.length.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} matching events, newest first.`}</p>
    <div className="mt-4 space-y-3">{events.map((event) => <article key={event.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold text-white">{event.event_type}</h4><p className="mt-1 break-all text-xs text-slate-300">{event.email || 'No recipient email'} · {endpoints.find((endpoint) => endpoint.id === event.endpoint_id)?.name || 'Brevo endpoint'}</p><p className="mt-2 text-xs text-slate-500">{formatDate(event.received_at)} · {event.status}</p></div><div className="flex gap-2"><button type="button" onClick={() => void viewEvent(event)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white">View event</button><button type="button" disabled={busy} onClick={() => void review(event)} className="inline-flex items-center gap-1 rounded-lg bg-cyan-900 px-3 py-2 text-xs text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />{event.status === 'reviewed' ? 'Mark received' : 'Mark reviewed'}</button></div></div>{selectedEvent?.id === event.id && <div className="mt-4"><p className="text-xs text-slate-400">Stored payload (sensitive credential fields are redacted)</p><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-4 text-xs text-slate-200">{JSON.stringify(selectedEvent.payload, null, 2)}</pre><button type="button" onClick={() => { detailRequestId.current += 1; setSelectedEvent(null); }} className="mt-2 text-xs text-cyan-200 underline">Close event</button></div>}</article>)}</div>
    {loading ? <p role="status" className="mt-4 text-sm text-slate-400">Loading events...</p> : events.length === 0 ? <p className="mt-4 text-sm text-slate-400">No events in this view yet.</p> : null}
    {hasMore && <button type="button" disabled={loading} onClick={() => void loadEvents(true)} className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Load older events</button>}
  </section>;
}
