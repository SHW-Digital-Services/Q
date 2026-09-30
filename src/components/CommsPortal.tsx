import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Search, RefreshCw, Plus, Send, Paperclip, X, BookOpen, LogOut, ArrowLeft } from 'lucide-react';
import DOMPurify from 'dompurify';
import { getSupabaseClient } from '../services/supabase';
import { EmailTemplatesSection } from './EmailTemplatesSection';
import { templatePlaceholders } from '../data/emailTemplates';

type MailAccount = { accountId: string; email: string; name: string };
type Folder = { folderId: string; name: string; type: string };
type MailMessage = { messageId: string; folderId: string; subject: string; from: string; to: string; summary: string; receivedAt: string; unread: boolean; hasAttachment: boolean };
type Attachment = { id: string; name: string; size: number };
type MailDetail = { content: string; attachments: Attachment[] };
type Upload = { name: string; proof: string };
const emptyComposer = { to: '', cc: '', bcc: '', subject: '', content: '', replyTo: '' };
const control = 'rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-40';
const button = `${control} inline-flex min-h-11 items-center justify-center gap-2 hover:bg-white/10`;
const readableDate = (value: string) => { const date = new Date(Number(value)); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB'); };

export default function CommsPortal({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; mailUrl: string } | null>(null);
  const [tab, setTab] = useState<'mail' | 'templates'>('mail');
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [account, setAccount] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState('');
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [start, setStart] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composer, setComposer] = useState(emptyComposer);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [moveFolder, setMoveFolder] = useState('');
  const requestVersion = useRef(0);
  const composeRef = useRef(composer); composeRef.current = composer;
  const safeHtml = useMemo(() => detail ? DOMPurify.sanitize(detail.content, { ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'hr'], ALLOWED_ATTR: ['colspan', 'rowspan'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false }) : '', [detail]);

  async function mailRequest(path: string, init: RequestInit = {}, signal?: AbortSignal) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Q sign-in is not configured. Contact an Admin.');
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error('Sign in to Q to use communications.');
    const response = await fetch(`/api/comms${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', signal, headers: { ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers, Authorization: `Bearer ${data.session.access_token}` } });
    if (!response.ok) { const result = await response.json().catch(() => ({})); if (result.code === 'MAIL_CONNECTION_REQUIRED') setStatus(s => s ? { ...s, connected: false } : s); throw new Error(result.error || 'Unable to complete this email request.'); }
    return response;
  }
  const mailJson = async (path: string, init?: RequestInit, signal?: AbortSignal) => (await mailRequest(path, init, signal)).json();
  const postJson = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
  const report = (err: unknown) => setError(err instanceof Error ? err.message : 'Unable to complete this email request.');
  function clearMailbox() { requestVersion.current++; setMessages([]); setSelected(null); setDetail(null); setFolders([]); setAccount(''); setFolder(''); setAccounts([]); setComposer(emptyComposer); setUploads([]); setComposeOpen(false); }

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const connection = params.get('connection');
    if (connection) {
      window.history.replaceState({}, '', '/crm/comms');
      if (connection === 'connected') setNotice('Open the shared office mailbox below.');
      else setError(connection === 'denied' ? 'The Zoho connection was cancelled. You can connect when you’re ready.' : 'The mailbox could not be connected. Check the Zoho application settings and try again.');
    }
    mailJson('/status', undefined, controller.signal).then(setStatus).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const supabase = getSupabaseClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { clearMailbox(); setStatus(null); } });
    return () => { controller.abort(); subscription?.data.subscription.unsubscribe(); requestVersion.current++; };
  }, []);
  useEffect(() => {
    if (!status?.connected) { clearMailbox(); return; }
    const controller = new AbortController(); setLoading(true);
    mailJson('/accounts', undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setAccounts(data.accounts); setAccount(data.accounts[0]?.accountId || ''); if (!data.accounts.length) setError('Zoho did not return a mailbox. Check the account’s mail and API access.'); } }).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status?.connected]);
  useEffect(() => {
    requestVersion.current++; setFolders([]); setFolder(''); setMessages([]); setSelected(null); setDetail(null); setComposer(emptyComposer); setComposeOpen(false); setUploads([]); setSearchText(''); setSearch(''); setStart(1);
    if (!account) return;
    const controller = new AbortController(); setLoading(true);
    mailJson(`/accounts/${account}/folders`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setFolders(data.folders); setFolder(data.folders.find((f: Folder) => f.type?.toLowerCase() === 'inbox')?.folderId || data.folders[0]?.folderId || ''); } }).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account]);
  useEffect(() => {
    requestVersion.current++; setMessages([]); setSelected(null); setDetail(null); setMoveFolder('');
    if (!account || !folder) return;
    const controller = new AbortController(); setLoading(true); setError('');
    mailJson(`/accounts/${account}/messages?${new URLSearchParams({ folder, start: String(start), search })}`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setMessages(data.messages); setHasMore(data.hasMore); } }).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account, folder, search, start, revision]);
  useEffect(() => {
    if (!composeOpen) return;
    const warn = (event: BeforeUnloadEvent) => { if (composeRef.current.content.trim() || composeRef.current.subject.trim()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [composeOpen]);

  async function openMessage(message: MailMessage) {
    const version = ++requestVersion.current; setSelected(message); setDetail(null); setReading(true); setError('');
    try { const data = await mailJson(`/accounts/${account}/folders/${message.folderId}/messages/${message.messageId}`); if (version === requestVersion.current) setDetail(data); } catch (e) { if (version === requestVersion.current) report(e); } finally { if (version === requestVersion.current) setReading(false); }
  }
  function beginCompose(next = emptyComposer) {
    if (composeOpen && (composer.subject || composer.content) && !window.confirm('Replace the unsaved message currently open in Q?')) return;
    setComposer({ ...next }); setUploads([]); setComposeOpen(true); setTab('mail'); setNotice('');
  }
  async function send(draft = false) {
    if (busy) return;
    if (!draft && templatePlaceholders(composer.subject, composer.content).length) { setError('Fill in all template placeholders before sending.'); return; }
    if (!draft && !window.confirm(`Send this email to ${composer.to}${composer.cc ? ` (Cc: ${composer.cc})` : ''}${composer.bcc ? ` (Bcc: ${composer.bcc})` : ''}?`)) return;
    setBusy(true); setError('');
    try { await mailJson(`/accounts/${account}/send`, postJson({ ...composer, attachments: uploads.map(a => a.proof), draft })); setComposeOpen(false); setComposer(emptyComposer); setUploads([]); setNotice(draft ? 'A new draft was saved in Zoho. Open Zoho Mail to continue editing it.' : 'Your email was accepted by Zoho for sending.'); setRevision(v => v + 1); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function uploadFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    const list = Array.from(files);
    if (list.some(f => f.size > 3 * 1024 * 1024 || !f.size) || uploads.length + list.length > 10) { setError('Choose up to 10 attachments, each no larger than 3 MB.'); return; }
    setBusy(true); setError('');
    try { for (const file of list) { const result = await mailJson(`/accounts/${account}/attachments?${new URLSearchParams({ name: file.name })}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file }); setUploads(current => [...current, result.attachment]); } } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function download(attachment: Attachment) {
    if (!selected) return; setBusy(true); setError('');
    try { const response = await mailRequest(`/accounts/${account}/folders/${selected.folderId}/messages/${selected.messageId}/attachments/${attachment.id}`); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = attachment.name.replace(/[\x00-\x1f/\\]/g, '_'); link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function messageAction(action: 'read' | 'unread' | 'archive' | 'move') {
    if (!selected || busy) return; setBusy(true); setError('');
    try { await mailJson(`/accounts/${account}/messages/${selected.messageId}`, { method: 'PATCH', body: JSON.stringify({ action, ...(action === 'move' ? { folderId: moveFolder } : {}) }) }); setNotice('Your mailbox was updated in Zoho.'); setRevision(v => v + 1); } catch (e) { report(e); } finally { setBusy(false); }
  }
  return <main className="mx-auto w-full max-w-7xl bg-slate-950 p-4 text-slate-100 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-purple-300">Q Customer Operations</p><h1 className="mt-2 flex items-center gap-2 text-2xl font-bold"><Mail className="h-6 w-6" /> Communications</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">The shared office@q-ai.online mailbox, inside Q. Messages and attachments stay in Zoho and aren’t saved to Supabase.</p></div><div className="flex flex-wrap gap-2"><a href="/crm" className={button}><ArrowLeft className="h-4 w-4" /> Back to CRM</a><button disabled={busy} onClick={() => void onSignOut()} className={button}><LogOut className="h-4 w-4" /> Log out</button></div></header>
    <nav aria-label="Communications sections" className="mt-6 flex flex-wrap gap-2"><button onClick={() => setTab('mail')} aria-pressed={tab === 'mail'} className={`${button} ${tab === 'mail' ? 'border-purple-400 bg-purple-500/15' : ''}`}><Mail className="h-4 w-4" /> Mailbox</button><button onClick={() => setTab('templates')} aria-pressed={tab === 'templates'} className={`${button} ${tab === 'templates' ? 'border-purple-400 bg-purple-500/15' : ''}`}><BookOpen className="h-4 w-4" /> Email templates</button></nav>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {status && !status.configured && <section className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5"><h2 className="font-bold text-amber-100">Zoho Mail setup required</h2><p className="mt-2 text-sm text-slate-300">An admin needs to register Q in Zoho’s API Console and configure the connection. You can browse the templates below while that’s being set up.</p><a href="https://api-console.zoho.eu/" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-purple-200 underline">Open Zoho API Console</a></section>}

    {tab === 'templates' && <EmailTemplatesSection canUse={Boolean(status?.connected && account && !busy)} onUse={(subject, content) => beginCompose({ ...emptyComposer, subject, content })} />}
    {tab === 'mail' && status?.connected && <>
      <div className="mt-5 flex flex-wrap items-center gap-2"><span className="rounded-xl border border-white/10 px-3 py-2 text-sm">office@q-ai.online</span><button onClick={() => beginCompose()} disabled={!account || busy} className={button}><Plus className="h-4 w-4" /> Compose</button><button onClick={() => setRevision(v => v + 1)} disabled={loading || busy} className={button}><RefreshCw className="h-4 w-4" /> Refresh</button><a href={status.mailUrl} target="_blank" rel="noreferrer" className={button}>Open Zoho Mail</a></div>
      {composeOpen && <section aria-label="Email composer" className="mt-5 rounded-2xl border border-purple-400/30 bg-purple-500/5 p-4 sm:p-5"><div className="flex items-center justify-between"><h2 className="font-bold">{composer.replyTo ? 'Reply' : 'New email'}</h2><button aria-label="Discard unsaved email" disabled={busy} onClick={() => { if ((!composer.subject && !composer.content) || window.confirm('Discard this unsaved email?')) { setComposeOpen(false); setComposer(emptyComposer); setUploads([]); } }} className={button}><X className="h-4 w-4" /></button></div><p className="mt-2 text-xs text-slate-400">From {accounts.find(a => a.accountId === account)?.email}. This message is only held on this page until you send it or save a new draft in Zoho.</p>
        <fieldset disabled={busy} className="mt-4 grid gap-3 sm:grid-cols-2">{(['to', 'cc', 'bcc', 'subject'] as const).map(key => <label key={key} className={`text-xs text-slate-300 ${key === 'subject' ? 'sm:col-span-2' : ''}`}><span className="mb-1 block">{({ to: 'To', cc: 'Cc', bcc: 'Bcc', subject: 'Subject' })[key]}</span><input value={composer[key]} maxLength={key === 'subject' ? 300 : 3000} onChange={e => setComposer({ ...composer, [key]: e.target.value })} placeholder={key === 'subject' ? 'Email subject' : 'Email addresses, separated by commas'} className={`${control} w-full`} /></label>)}<label className="text-xs text-slate-300 sm:col-span-2"><span className="mb-1 block">Message</span><textarea value={composer.content} maxLength={50000} onChange={e => setComposer({ ...composer, content: e.target.value })} rows={12} className={`${control} w-full resize-y leading-relaxed`} /></label></fieldset>
        <div className="mt-3 flex flex-wrap gap-2">{uploads.map((a, i) => <span key={a.proof} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs">{a.name}<button disabled={busy} aria-label={`Remove ${a.name}`} onClick={() => setUploads(items => items.filter((_, index) => index !== i))}><X className="h-3 w-3" /></button></span>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><label className={button}><Paperclip className="h-4 w-4" /> Add attachments<input type="file" multiple disabled={busy} onChange={e => { void uploadFiles(e.target.files); e.target.value = ''; }} className="sr-only" /></label><button disabled={busy || !composer.to || !composer.subject || !composer.content} onClick={() => void send()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold disabled:opacity-40"><Send className="h-4 w-4" /> {busy ? 'Working…' : 'Send email'}</button>{!composer.replyTo && <button disabled={busy || !composer.to || !composer.subject || !composer.content} onClick={() => void send(true)} className={button}>Save new draft in Zoho</button>}</div><p className="mt-2 text-xs text-slate-500">Up to 10 attachments, 3 MB each. Reply drafts stay on this page until sent. Q does not autosave drafts.</p>
      </section>}
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[180px_320px_minmax(0,1fr)]">
        <nav aria-label="Mail folders" className="flex flex-wrap gap-2 lg:flex-col">{folders.map(f => <button key={f.folderId} disabled={busy} aria-pressed={folder === f.folderId && !search} onClick={() => { setFolder(f.folderId); setSearch(''); setSearchText(''); setStart(1); }} className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm ${folder === f.folderId && !search ? 'bg-purple-500/20 text-purple-100' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>{f.name}</button>)}</nav>
        <section aria-label="Message list" className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3"><form onSubmit={e => { e.preventDefault(); setStart(1); setSearch(searchText.trim()); }} className="flex gap-2"><input aria-label="Search Zoho mail" value={searchText} maxLength={300} onChange={e => setSearchText(e.target.value)} placeholder="Search mail" className={`${control} min-w-0 flex-1`} /><button aria-label="Search" className={button}><Search className="h-4 w-4" /></button></form><p className="mt-2 text-[11px] text-slate-500">Search uses Zoho’s search syntax across your mailbox.</p>
          {loading && <p role="status" className="p-4 text-sm text-slate-400">Loading from Zoho…</p>}{!loading && !messages.length && <p className="p-4 text-sm text-slate-400">No messages to show.</p>}
          <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto">{messages.map(m => <button key={m.messageId} onClick={() => void openMessage(m)} className={`w-full rounded-xl border p-3 text-left ${selected?.messageId === m.messageId ? 'border-purple-400/40 bg-purple-500/15' : 'border-white/5 bg-slate-900/60 hover:bg-white/10'}`}><span className="block truncate text-xs text-slate-400">{m.from}</span><span className={`mt-1 block break-words text-sm ${m.unread ? 'font-bold text-white' : 'text-slate-300'}`}>{m.subject}</span><span className="mt-1 block text-[11px] text-slate-500">{readableDate(m.receivedAt)}{m.hasAttachment ? ' · Attachment' : ''}</span></button>)}</div>
          <div className="mt-3 flex items-center justify-between gap-2"><button disabled={start === 1 || loading || busy} onClick={() => setStart(s => Math.max(1, s - 30))} className={button}>Newer</button><span className="text-xs text-slate-500">Page {Math.floor((start - 1) / 30) + 1}</span><button disabled={!hasMore || loading || busy} onClick={() => setStart(s => s + 30)} className={button}>Older</button></div>
        </section>
        <section aria-label="Selected email" className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">{!selected ? <p className="py-16 text-center text-sm text-slate-400">Choose an email to read it here.</p> : <><h2 className="break-words text-lg font-bold">{selected.subject}</h2><p className="mt-2 break-words text-xs text-slate-400">From: {selected.from}</p><p className="mt-1 break-words text-xs text-slate-400">To: {selected.to}</p><p className="mt-1 text-xs text-slate-500">{readableDate(selected.receivedAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy || reading || !detail || folders.find(f => f.folderId === selected.folderId)?.type?.toLowerCase() === 'drafts'} onClick={() => beginCompose({ ...emptyComposer, to: selected.from.match(/<([^>]+)>/)?.[1] || selected.from, subject: /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`, replyTo: selected.messageId })} className={button}>Reply</button><button disabled={busy} onClick={() => void messageAction(selected.unread ? 'read' : 'unread')} className={button}>{selected.unread ? 'Mark read' : 'Mark unread'}</button><button disabled={busy} onClick={() => void messageAction('archive')} className={button}>Archive</button><select aria-label="Move email to folder" value={moveFolder} onChange={e => setMoveFolder(e.target.value)} className={`${control} max-w-full`}><option value="">Move to…</option>{folders.filter(f => f.folderId !== selected.folderId).map(f => <option key={f.folderId} value={f.folderId}>{f.name}</option>)}</select><button disabled={busy || !moveFolder} onClick={() => void messageAction('move')} className={button}>Move</button></div>
          {reading && <p role="status" className="py-8 text-sm text-slate-400">Opening email from Zoho…</p>}{detail && <><p className="mt-4 text-[11px] text-slate-500">For your privacy, remote images and active content are removed. Open Zoho Mail for the original layout and links.</p><div className="mt-3 max-h-[600px] overflow-auto rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-900 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:whitespace-pre-wrap [&_table]:max-w-full" dangerouslySetInnerHTML={{ __html: safeHtml }} /><div className="mt-3 flex flex-wrap gap-2">{detail.attachments.map(a => <button key={a.id} disabled={busy} onClick={() => void download(a)} className={`${button} max-w-full break-all`}><Paperclip className="h-4 w-4 shrink-0" />{a.name}</button>)}</div></>}
        </>}</section>
      </div>
    </>}{loading && !status && <p role="status" className="py-8 text-sm text-slate-400">Checking communications access…</p>}
  </main>;
}
