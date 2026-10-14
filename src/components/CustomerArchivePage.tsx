import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Download, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

type Customer = { id: string; name: string; email: string; role: string; signupAt: string; lastSignInAt: string | null };
type Criterion = 'signup' | 'sign_in' | 'activity';
const MAX_SELECTED = 25;
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50';

export default function CustomerArchivePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [criterion, setCriterion] = useState<Criterion>('signup');
  const [days, setDays] = useState('180');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [deleteResults, setDeleteResults] = useState<{ name: string; ok: boolean; message: string }[] | null>(null);

  async function authHeaders() {
    const { data } = await getSupabaseClient()!.auth.getSession();
    if (!data.session) throw new Error('Sign in with an administrator account to manage customer archives.');
    return { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' };
  }

  async function loadCustomers() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/v1/admin/customer-archive/customers', { headers: await authHeaders(), cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load customers.');
      setCustomers(data.customers || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load customers.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadCustomers(); }, []);

  const visible = useMemo(() => customers.filter(customer => `${customer.name} ${customer.email}`.toLowerCase().includes(search.trim().toLowerCase())), [customers, search]);
  const selectedCustomers = selected.map(id => customers.find(customer => customer.id === id)).filter((customer): customer is Customer => !!customer);

  function toggleCustomer(id: string) {
    setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length < MAX_SELECTED ? [...previous, id] : previous);
    setStatus(''); setDeleteResults(null);
  }

  async function selectByPeriod() {
    const numberOfDays = Number(days);
    if (!Number.isInteger(numberOfDays) || numberOfDays < 1 || numberOfDays > 3650) { setError('Choose a period between 1 and 3,650 days.'); return; }
    setBusy(true); setError(''); setStatus(''); setDeleteResults(null);
    try {
      const response = await fetch('/api/v1/admin/customer-archive/candidates', { method: 'POST', headers: await authHeaders(), cache: 'no-store', body: JSON.stringify({ criterion, days: numberOfDays }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find matching customers.');
      const matches: Customer[] = data.customers || [];
      if (matches.length > MAX_SELECTED) {
        setSelected(matches.slice(0, MAX_SELECTED).map(customer => customer.id));
        setStatus(`Found ${matches.length} matching accounts. Selected the first ${MAX_SELECTED}; archive in batches of up to ${MAX_SELECTED}.`);
      } else {
        setSelected(matches.map(customer => customer.id));
        setStatus(`${matches.length} customer${matches.length === 1 ? '' : 's'} match this period.`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not find matching customers.'); }
    finally { setBusy(false); }
  }

  async function createArchive() {
    if (!selected.length || busy) return;
    setBusy(true); setError(''); setStatus('Preparing the ZIP archive…'); setDeleteResults(null); setDeletePrompt(false);
    try {
      const response = await fetch('/api/v1/admin/customer-archive/export', { method: 'POST', headers: await authHeaders(), cache: 'no-store', body: JSON.stringify({ customerIds: selected }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'The customer archive could not be prepared.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = `q-customer-archive-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setStatus(`Downloaded the archive for ${selected.length} customer${selected.length === 1 ? '' : 's'}.`);
      setDeletePrompt(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'The customer archive could not be prepared.'); setStatus(''); }
    finally { setBusy(false); }
  }

  async function deleteArchivedCustomers() {
    if (busy || !selectedCustomers.length) return;
    setBusy(true); setError(''); setDeletePrompt(false); setStatus('Deleting selected customer accounts…');
    const results: { name: string; ok: boolean; message: string }[] = [];
    for (const customer of selectedCustomers) {
      try {
        const response = await fetch(`/api/v1/admin/delete-users/${customer.id}`, { method: 'DELETE', cache: 'no-store', headers: await authHeaders(), body: JSON.stringify({ confirmation: customer.email }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not delete this account.');
        results.push({ name: customer.name, ok: true, message: 'Deleted from Q.' });
      } catch (e) { results.push({ name: customer.name, ok: false, message: e instanceof Error ? e.message : 'Could not delete this account.' }); }
    }
    const deletedIds = new Set(selectedCustomers.filter((_customer, index) => results[index]?.ok).map(customer => customer.id));
    setCustomers(previous => previous.filter(customer => !deletedIds.has(customer.id)));
    setSelected(previous => previous.filter(id => !deletedIds.has(id)));
    setDeleteResults(results); setStatus('Deletion finished. Review the result for each selected account.'); setBusy(false);
  }

  return <main className="mx-auto w-full max-w-6xl text-slate-100">
    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-4 sm:p-6"><div className="flex items-start gap-3"><ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-300"/><div><h2 className="font-bold text-amber-100">Administrator-only customer data</h2><p className="mt-1 text-sm leading-6 text-slate-300">The ZIP contains private account and support records. Keep it in an approved secure location and handle it according to your retention policy. Account deletion is a separate choice after the download.</p></div></div></section>

    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Select customers</h2><p className="mt-1 text-sm text-slate-400">Choose accounts directly or find them by age or activity.</p></div><button type="button" onClick={() => void loadCustomers()} disabled={loading || busy} className={button}><RefreshCw className="h-4 w-4"/>Refresh</button></div>
        <label className="mt-5 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3"><Search className="h-4 w-4 text-slate-400"/><span className="sr-only">Search customers</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer name or email" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/></label>
        <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-white/10">
          {loading ? <p role="status" className="p-4 text-sm text-slate-400">Loading customers…</p> : visible.length ? <ul className="divide-y divide-white/10">{visible.map(customer => <li key={customer.id} className="flex items-start gap-3 p-3"><input aria-label={`Select ${customer.name}, ${customer.email}`} type="checkbox" checked={selected.includes(customer.id)} disabled={busy || (!selected.includes(customer.id) && selected.length >= MAX_SELECTED)} onChange={() => toggleCustomer(customer.id)} className="mt-1 h-4 w-4 accent-violet-500"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{customer.name}</p><p className="truncate text-xs text-slate-400">{customer.email}</p><p className="mt-1 text-xs text-slate-500">Joined {new Date(customer.signupAt).toLocaleDateString('en-GB')} · Last sign-in {customer.lastSignInAt ? new Date(customer.lastSignInAt).toLocaleDateString('en-GB') : 'Never'}</p></div></li>)}</ul> : <p className="p-4 text-sm text-slate-400">No customers match this search.</p>}
        </div>
        <p className="mt-3 text-xs text-slate-400">{selected.length} selected · Maximum {MAX_SELECTED} per ZIP</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6">
        <h2 className="text-lg font-bold">Select by period</h2><p className="mt-1 text-sm text-slate-400">Find accounts whose selected date is older than the period below.</p>
        <label className="mt-5 block text-sm text-slate-300">Measure the period<select value={criterion} disabled={busy} onChange={event => setCriterion(event.target.value as Criterion)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white"><option value="signup">Account creation date</option><option value="sign_in">Last sign-in (includes never signed in)</option><option value="activity">Last recorded account activity</option></select></label>
        <label className="mt-4 block text-sm text-slate-300">Older than (days)<input type="number" min="1" max="3650" step="1" value={days} disabled={busy} onChange={event => setDays(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white"/></label>
        {criterion === 'activity' && <p className="mt-3 text-xs leading-5 text-slate-500">Activity considers sign-in and dated records in profiles, journal, memory, chat, support, CRM, feedback, peer contributions, referrals and subscription data.</p>}
        <button type="button" onClick={() => void selectByPeriod()} disabled={busy || loading} className="mt-5 w-full rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-600 disabled:opacity-50">{busy ? 'Working…' : 'Select matching customers'}</button>
      </div>
    </section>

    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
    {status && <p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-emerald-100">{status}</p>}
    {deleteResults && <section aria-label="Deletion results" className="mt-5 rounded-2xl border border-white/10 bg-slate-900/70 p-4"><h2 className="font-bold">Deletion results</h2><ul className="mt-3 space-y-2">{deleteResults.map((result, index) => <li key={`${result.name}-${index}`} className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-emerald-500/10 text-emerald-100' : 'bg-rose-500/10 text-rose-100'}`}><strong>{result.name}:</strong> {result.message}</li>)}</ul></section>}
    <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-sm text-slate-300">The archive includes account-linked Q records and available private support attachments. The ZIP must finish downloading before deletion can be offered.</p><button type="button" onClick={() => void createArchive()} disabled={busy || !selected.length} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"><Archive className="h-4 w-4"/>{busy ? 'Preparing…' : `Archive ${selected.length || ''} customer${selected.length === 1 ? '' : 's'}`}</button></section>

    {deletePrompt && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="archive-delete-title" className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl"><div className="flex items-start gap-3"><Download className="mt-1 h-5 w-5 text-emerald-300"/><div><h2 id="archive-delete-title" className="text-lg font-bold">ZIP downloaded</h2><p className="mt-2 text-sm leading-6 text-slate-300">Would you like to delete {selectedCustomers.length === 1 ? <strong>{selectedCustomers[0]?.name}</strong> : <strong>these {selectedCustomers.length} customer accounts</strong>} from Supabase? This removes the Q login and account-linked data covered by account deletion rules. PayPal subscriptions must be resolved first; some financial, security and support records may remain under retention rules. Already-issued access tokens may stay valid until they expire.</p><p className="mt-3 text-xs text-slate-400">Yes processes accounts individually; any blocked accounts remain and are reported. No keeps them in Q.</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeletePrompt(false)} className={button}>No, keep in Q</button><button type="button" disabled={busy} onClick={() => void deleteArchivedCustomers()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50"><Trash2 className="h-4 w-4"/>Yes, delete</button></div></section></div>}
  </main>;
}
