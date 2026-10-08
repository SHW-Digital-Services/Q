import { useCrmDraftState } from '../hooks/useCrmDraftState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Search, RefreshCw, Plus, Send, Paperclip, X, BookOpen, LogOut, ArrowLeft, Trash2 } from 'lucide-react';
import { renderMailHtml } from '../services/mailHtml';
import { getSupabaseClient } from '../services/supabase';
import { EmailTemplatesSection } from './EmailTemplatesSection';
import { templatePlaceholders } from '../data/emailTemplates';
import { inboxFolder, trashFolder, combinedInboxFolders, visibleMailFolders, type MailFolder } from '../services/mailFolders';
import SupportInbox from './SupportInbox';
import HelpArticleAdmin from './HelpArticleAdmin';
import FeedbackWorkspace from './FeedbackWorkspace';

type MailAccount = { accountId: string; email: string; name: string };
type Folder = MailFolder;
type MailMessage = { messageId: string; folderId: string; subject: string; from: string; to: string; summary: string; receivedAt: string; unread: boolean; hasAttachment: boolean };
type Attachment = { id: string; name: string; size: number };
type MailDetail = { content: string; images?: Record<string, string>; attachments: Attachment[] };
type Upload = { name: string; proof: string };
const emptyComposer = { to: '', cc: '', bcc: '', subject: '', content: '', replyTo: '' };
const control = 'rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-40';
const button = `${control} inline-flex min-h-11 items-center justify-center gap-2 hover:bg-white/10`;
const unreadBadge = 'ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white';
const readableDate = (value: string) => { const date = new Date(Number(value)); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB'); };

export default function CommsPortal({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; mailUrl: string; mailbox: string; personalAvailable?: boolean } | null>(null);
  const [personalAvailable, setPersonalAvailable] = useState(false);
  const [mailboxMode, setMailboxMode] = useCrmDraftState('mailboxMode', '');
  const initialSection = new URLSearchParams(window.location.search).get('section');
  const [tab, setTab] = useCrmDraftState<'mail' | 'templates' | 'support' | 'feedback' | 'help'>('tab', initialSection === 'feedback' ? 'feedback' : initialSection === 'help' ? 'help' : initialSection === 'templates' ? 'templates' : initialSection === 'mail' || new URLSearchParams(window.location.search).has('message') ? 'mail' : 'support');
  useEffect(() => { const section=initialSection;if(['feedback','help','templates','support','mail'].includes(section||''))setTab(section as any);else if(!new URLSearchParams(window.location.search).has('message'))setTab('support'); }, [initialSection, setTab]);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [account, setAccount] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState('');
  const trashFolderId = trashFolder(folders);
  const displayedFolders = visibleMailFolders(folders);
  const totalUnread = folders.reduce((total, item) => total + (item.unreadCount || 0), 0);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkMoveFolder, setBulkMoveFolder] = useState('');
  const bulkInFlight = useRef(false);
  const checkedMessages = messages.filter(message => checkedIds.includes(message.messageId));
  const allChecked = messages.length > 0 && checkedMessages.length === messages.length;
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [searchText, setSearchText] = useCrmDraftState(`mail:${mailboxMode}:${account}:searchText`, '');
  const [search, setSearch] = useState('');
  const [start, setStart] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useCrmDraftState(`mail:${mailboxMode}:${account}:composeOpen`, false);
  const [composer, setComposer] = useCrmDraftState(`mail:${mailboxMode}:${account}:composer`, emptyComposer);
  const [uploads, setUploads] = useCrmDraftState<Upload[]>(`mail:${mailboxMode}:${account}:uploads`, []);
  const [moveFolder, setMoveFolder] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(soundEnabled); soundEnabledRef.current = soundEnabled;
  const unreadBaseline = useRef<Map<string, number> | null>(null);
  const [folderRevision, setFolderRevision] = useState(0);
  const requestVersion = useRef(0);
  const linkedMessage = useRef(new URLSearchParams(window.location.search).get('message'));
  const composeRef = useRef(composer); composeRef.current = composer;
  const safeHtml = useMemo(() => detail ? renderMailHtml(detail.content, detail.images) : '', [detail]);
  function ping() {
    const context = audio.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.start(); oscillator.stop(context.currentTime + 0.36);
  }
  async function toggleSound() {
    if (soundEnabled) { setSoundEnabled(false); return; }
    try {
      audio.current ||= new AudioContext(); await audio.current.resume();
      setSoundEnabled(true); ping();
    } catch { setError('Your browser could not enable notification sounds.'); }
  }
  useEffect(() => () => { void audio.current?.close(); }, []);

  async function mailRequest(path: string, init: RequestInit = {}, signal?: AbortSignal) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Q sign-in is not configured. Contact an Admin.');
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error('Sign in to Q to use communications.');
    const response = await fetch(`/api/comms${mailboxMode}${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', signal, headers: { ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers, Authorization: `Bearer ${data.session.access_token}` } });
    if (!response.ok) { const result = await response.json().catch(() => ({})); if (result.code === 'MAIL_CONNECTION_REQUIRED') setStatus(s => s ? { ...s, connected: false } : s); throw new Error(result.error || 'Unable to complete this email request.'); }
    return response;
  }
  const mailJson = async (path: string, init?: RequestInit, signal?: AbortSignal) => (await mailRequest(path, init, signal)).json();
  const postJson = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
  const report = (err: unknown) => setError(err instanceof Error ? err.message : 'Unable to complete this email request.');
  function clearMailbox() { unreadBaseline.current = null; requestVersion.current++; setCheckedIds([]); setBulkMoveFolder(''); setMessages([]); setSelected(null); setDetail(null); setFolders([]); setAccount(''); setFolder(''); setAccounts([]); }

  useEffect(() => { setCheckedIds([]); setBulkMoveFolder(''); }, [account, mailboxMode, folder, search, start]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const connection = params.get('connection');
    if (connection) {
      window.history.replaceState({}, '', '/crm/comms');
      if (connection === 'connected') setNotice('Open the shared office mailbox below.');
      else setError(connection === 'denied' ? 'The Zoho connection was cancelled. You can connect when you’re ready.' : 'The mailbox could not be connected. Check the Zoho application settings and try again.');
    }
    mailJson('/status', undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setStatus(data); if (!mailboxMode) setPersonalAvailable(Boolean(data.personalAvailable)); } }).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const supabase = getSupabaseClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { setComposer(emptyComposer); setUploads([]); setComposeOpen(false); clearMailbox(); setStatus(null); } });
    return () => { controller.abort(); subscription?.data.subscription.unsubscribe(); requestVersion.current++; };
  }, [mailboxMode]);
  useEffect(() => {
    if (!status) return;
    if (!status.connected) { clearMailbox(); return; }
    const controller = new AbortController(); setLoading(true);
    mailJson('/accounts', undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setAccounts(data.accounts); setAccount(data.accounts[0]?.accountId || ''); if (!data.accounts.length) setError('Zoho did not return a mailbox. Check the account’s mail and API access.'); } }).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status?.connected]);
  useEffect(() => {
    unreadBaseline.current = null; requestVersion.current++; setFolders([]); setFolder(''); setMessages([]); setSelected(null); setDetail(null); setSearch(''); setStart(1);
    if (!account) return;
    const controller = new AbortController(); setLoading(true);
    mailJson(`/accounts/${account}/folders`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setFolders(data.folders); const linkedFolder = new URLSearchParams(window.location.search).get('folder'); setFolder(combinedInboxFolders(data.folders).some((f: Folder) => f.folderId === linkedFolder) ? inboxFolder(data.folders) : data.folders.some((f: Folder) => f.folderId === linkedFolder) ? linkedFolder : inboxFolder(data.folders)); } }).catch(e => { if (!controller.signal.aborted) report(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account]);
  useEffect(() => {
    requestVersion.current++; setMessages([]); setSelected(null); setDetail(null); setMoveFolder('');
    if (!account || !folder) return;
    const controller = new AbortController(); setLoading(true); setError('');
    let pending = false;
    const refreshMessages = async (background = false) => {
      if (pending) return;
      pending = true;
      try {
        const data = await mailJson(`/accounts/${account}/messages?${new URLSearchParams({ folder, start: String(start), search, ...(folder === inboxFolder(folders) ? {inbox: 'true'} : {}) })}`, undefined, controller.signal);
        if (controller.signal.aborted) return;
        // Update only the list. Keep the open message, composer and input focus.
        setMessages(data.messages); setHasMore(data.hasMore);
        setCheckedIds(ids => ids.filter(id => data.messages.some((message: MailMessage) => message.messageId === id)));
        if (!background && linkedMessage.current && /^\d{1,30}$/.test(linkedMessage.current)) {
          const id = linkedMessage.current; linkedMessage.current = null;
          void openMessage(data.messages.find((m: MailMessage) => m.messageId === id) || { messageId: id, folderId: folder, subject: 'Customer email', from: '', to: '', summary: '', receivedAt: '', unread: false, hasAttachment: false });
        }
      } catch (e) { if (!controller.signal.aborted) report(e); }
      finally {
        pending = false;
        if (!background && !controller.signal.aborted) setLoading(false);
      }
    };
    void refreshMessages();
    const timer = window.setInterval(() => void refreshMessages(true), 10_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [account, mailboxMode, folder, search, start, revision]);
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await mailJson(`/accounts/${account}/folders`, undefined, controller.signal);
        if (controller.signal.aborted) return;
        const next = new Map<string, number>(data.folders.map((f: Folder) => [f.folderId, f.unreadCount || 0]));
        const previous = unreadBaseline.current;
        const increases = combinedInboxFolders(data.folders).filter((f: Folder) => (f.unreadCount || 0) > (previous?.get(f.folderId) || 0));
        if (previous && increases.length) {
          setNotice('New unread mail in Inbox.');
          if (soundEnabledRef.current) ping();
        }
        unreadBaseline.current = next; setFolders(data.folders);
      } catch (e) { if (!controller.signal.aborted) report(e); }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [account, mailboxMode, folderRevision]);
  useEffect(() => {
    if (!composeOpen) return;
    const warn = (event: BeforeUnloadEvent) => { if (composeRef.current.content.trim() || composeRef.current.subject.trim()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [composeOpen]);

  async function openMessage(message: MailMessage) {
    const version = ++requestVersion.current; setSelected(message); setDetail(null); setReading(true); setError('');
    try { const data = await mailJson(`/accounts/${account}/folders/${message.folderId}/messages/${message.messageId}`); if (version === requestVersion.current) setDetail(data); } catch (e) { if (version === requestVersion.current) report(e); } finally { if (version === requestVersion.current) setReading(false); }
  }
  function beginCompose(next?: typeof emptyComposer) {
    // Reopening a closed composer continues the recovered draft.
    if (next && Object.values(composer).some(value => value.trim()) && !window.confirm('Replace the unsaved message currently open in Q?')) return;
    if (next) { setComposer({ ...next }); setUploads([]); }
    setComposeOpen(true); setTab('mail'); setNotice('');
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
  async function messageAction(action: 'read' | 'unread' | 'archive' | 'move' | 'trash') {
    if (!selected || busy) return;
    if (action === 'trash' && !trashFolderId) { setError('The Trash folder is unavailable. Refresh the mailbox and try again.'); return; }
    setBusy(true); setError('');
    try { await mailJson(`/accounts/${account}/messages/${selected.messageId}`, { method: 'PATCH', body: JSON.stringify({ action: action === 'trash' ? 'move' : action, ...(['move', 'trash'].includes(action) ? { folderId: action === 'trash' ? trashFolderId : moveFolder } : {}) }) }); unreadBaseline.current = null; setNotice(action === 'trash' ? 'Email moved to Trash in Zoho.' : 'Your mailbox was updated in Zoho.'); setFolderRevision(v => v + 1); setRevision(v => v + 1); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function bulkAction(action: 'read' | 'unread' | 'archive' | 'move' | 'trash') {
    if (busy || bulkInFlight.current || !account || !checkedMessages.length) return;
    const destination = action === 'trash' ? trashFolderId : bulkMoveFolder;
    if ((action === 'trash' || action === 'move') && (!destination || !folders.some(item => item.folderId === destination))) {
      setError('Choose an available destination folder.'); return;
    }
    const targets = action === 'trash' || action === 'move'
      ? checkedMessages.filter(message => message.folderId !== destination) : checkedMessages;
    if (!targets.length) { setError('The selected emails are already in that folder.'); return; }
    if (action === 'trash' && !window.confirm(`Move ${targets.length} selected email${targets.length === 1 ? '' : 's'} to Trash?`)) return;
    bulkInFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await mailJson(`/accounts/${account}/messages`, { method: 'PATCH', body: JSON.stringify({
        action: action === 'trash' ? 'move' : action,
        messageIds: targets.map(message => message.messageId),
        ...((action === 'move' || action === 'trash') ? { folderId: destination } : {}),
      }) });
      setCheckedIds([]); setBulkMoveFolder(''); unreadBaseline.current = null;
      setNotice(`${targets.length} email${targets.length === 1 ? '' : 's'} ${action === 'trash' ? 'moved to Trash' : action === 'move' ? 'moved to the selected folder' : action === 'archive' ? 'archived' : `marked ${action}`} in Zoho.`);
      setFolderRevision(value => value + 1); setRevision(value => value + 1);
    } catch (err) { report(err); }
    finally { bulkInFlight.current = false; setBusy(false); }
  }
  return <main className="w-full min-w-0 text-slate-100">
    <header><h1 className="text-3xl font-bold tracking-tight">Communications</h1><p className="mt-2 text-sm text-slate-400">Customer tickets, office email and support publishing in one workspace.</p></header>
    <button type="button" aria-pressed={soundEnabled} onClick={() => void toggleSound()} className={`${button} mt-4`}>{soundEnabled ? 'Sound notifications on' : 'Enable sound notifications'}</button>
    <nav aria-label="Communications sections" className="mt-6 flex flex-wrap gap-2"><button onClick={() => setTab('mail')} aria-pressed={tab === 'mail'} className={`${button} ${tab === 'mail' ? 'border-purple-400 bg-purple-500/15' : ''}`}><Mail className="h-4 w-4" /> Email tools{totalUnread > 0 && <span aria-label={`${totalUnread} unread emails across all folders`} className={unreadBadge}>{totalUnread}</span>}</button><button onClick={() => setTab('templates')} aria-pressed={tab === 'templates'} className={`${button} ${tab === 'templates' ? 'border-purple-400 bg-purple-500/15' : ''}`}><BookOpen className="h-4 w-4" /> Email templates</button><button onClick={() => setTab('support')} aria-pressed={tab === 'support'} className={`${button} ${tab === 'support' ? 'border-purple-400 bg-purple-500/15' : ''}`}><Mail className="h-4 w-4" /> Tickets</button><button onClick={() => setTab('feedback')} aria-pressed={tab === 'feedback'} className={`${button} ${tab === 'feedback' ? 'border-purple-400 bg-purple-500/15' : ''}`}><BookOpen className="h-4 w-4" /> Feedback &amp; roadmap</button><button onClick={() => setTab('help')} aria-pressed={tab === 'help'} className={button}><BookOpen className="h-4 w-4" /> Help centre</button></nav>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {tab==='mail'&&personalAvailable && <label className="mt-5 flex items-center gap-3 text-sm">Mailbox<select aria-label="Select mailbox" className={control} value={mailboxMode} disabled={busy} onChange={e => { if (composeOpen && (composer.subject || composer.content) && !window.confirm('Keep this email draft and switch mailbox?')) return; clearMailbox(); setStatus(null); setError(''); setNotice(''); setLoading(true); setMailboxMode(e.target.value); }}><option value="">office@q-ai.online</option><option value="/personal">scott@q-ai.online</option></select></label>}
    {tab==='mail'&&status && !status.configured && <section className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5"><h2 className="font-bold text-amber-100">Zoho Mail setup required</h2><p className="mt-2 text-sm text-slate-300">An admin needs to register Q in Zoho’s API Console and configure the connection. You can browse the templates below while that’s being set up.</p><a href="https://api-console.zoho.eu/" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-purple-200 underline">Open Zoho API Console</a></section>}

    {tab === 'support' && <SupportInbox />}
    {tab === 'feedback' && <FeedbackWorkspace />}
    {tab === 'help' && <HelpArticleAdmin />}
    {tab === 'templates' && <EmailTemplatesSection canUse={Boolean(status?.connected && account && !busy)} onUse={(subject, content) => beginCompose({ ...emptyComposer, subject, content })} />}
    {tab === 'mail' && status?.connected && <>
      <div className="mt-5 flex flex-wrap items-center gap-2"><span className="rounded-xl border border-white/10 px-3 py-2 text-sm">{status.mailbox}</span><button onClick={() => beginCompose()} disabled={!account || busy} className={button}><Plus className="h-4 w-4" /> Compose</button><button onClick={() => { setStart(1); setFolderRevision(v => v + 1); setRevision(v => v + 1); }} disabled={loading || busy} className={button}><RefreshCw className="h-4 w-4" /> Refresh</button><a href={status.mailUrl} target="_blank" rel="noreferrer" className={button}>Open Zoho Mail</a></div>
      {composeOpen && <section aria-label="Email composer" className="mt-5 rounded-2xl border border-purple-400/30 bg-purple-500/5 p-4 sm:p-5"><div className="flex items-center justify-between"><h2 className="font-bold">{composer.replyTo ? 'Reply' : 'New email'}</h2><button aria-label="Discard unsaved email" disabled={busy} onClick={() => { if ((!composer.subject && !composer.content) || window.confirm('Discard this unsaved email?')) { setComposeOpen(false); setComposer(emptyComposer); setUploads([]); } }} className={button}><X className="h-4 w-4" /></button></div><p className="mt-2 text-xs text-slate-400">From {accounts.find(a => a.accountId === account)?.email}. Unsaved text is temporarily saved in this browser tab and restored after a refresh. Sending, saving in Zoho, or discarding clears this draft.</p>
        <fieldset disabled={busy} className="mt-4 grid gap-3 sm:grid-cols-2">{(['to', 'cc', 'bcc', 'subject'] as const).map(key => <label key={key} className={`text-xs text-slate-300 ${key === 'subject' ? 'sm:col-span-2' : ''}`}><span className="mb-1 block">{({ to: 'To', cc: 'Cc', bcc: 'Bcc', subject: 'Subject' })[key]}</span><input value={composer[key]} maxLength={key === 'subject' ? 300 : 3000} onChange={e => setComposer({ ...composer, [key]: e.target.value })} placeholder={key === 'subject' ? 'Email subject' : 'Email addresses, separated by commas'} className={`${control} w-full`} /></label>)}<label className="text-xs text-slate-300 sm:col-span-2"><span className="mb-1 block">Message</span><textarea value={composer.content} maxLength={50000} onChange={e => setComposer({ ...composer, content: e.target.value })} rows={12} className={`${control} w-full resize-y leading-relaxed`} /></label></fieldset>
        <div className="mt-3 flex flex-wrap gap-2">{uploads.map((a, i) => <span key={a.proof} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs">{a.name}<button disabled={busy} aria-label={`Remove ${a.name}`} onClick={() => setUploads(items => items.filter((_, index) => index !== i))}><X className="h-3 w-3" /></button></span>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><label className={button}><Paperclip className="h-4 w-4" /> Add attachments<input type="file" multiple disabled={busy} onChange={e => { void uploadFiles(e.target.files); e.target.value = ''; }} className="sr-only" /></label><button disabled={busy || !composer.to || !composer.subject || !composer.content} onClick={() => void send()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold disabled:opacity-40"><Send className="h-4 w-4" /> {busy ? 'Working…' : 'Send email'}</button>{!composer.replyTo && <button disabled={busy || !composer.to || !composer.subject || !composer.content} onClick={() => void send(true)} className={button}>Save new draft in Zoho</button>}</div><p className="mt-2 text-xs text-slate-500">Up to 10 attachments, 3 MB each. Email and reply text is temporarily saved in this browser tab until sent, saved in Zoho, or discarded. Closing the tab or logging out clears recovery.</p>
      </section>}
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[180px_320px_minmax(0,1fr)]">
        <nav aria-label="Mail folders" className="flex flex-wrap gap-2 lg:flex-col">{displayedFolders.map(f => <button key={f.folderId} disabled={busy} aria-pressed={folder === f.folderId && !search} onClick={() => { setFolder(f.folderId); setSearch(''); setSearchText(''); setStart(1); }} className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm ${folder === f.folderId && !search ? 'bg-purple-500/20 text-purple-100' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}><span>{f.name}</span>{Boolean(f.unreadCount) && <span aria-label={`${f.unreadCount} unread`} className={unreadBadge}>{f.unreadCount}</span>}</button>)}</nav>
        <section aria-label="Message list" className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3"><form onSubmit={e => { e.preventDefault(); if (busy) return; setStart(1); setSearch(searchText.trim()); }} className="flex gap-2"><input aria-label="Search Zoho mail" disabled={busy} value={searchText} maxLength={300} onChange={e => setSearchText(e.target.value)} placeholder="Search mail" className={`${control} min-w-0 flex-1`} /><button disabled={busy} aria-label="Search" className={button}><Search className="h-4 w-4" /></button></form><p className="mt-2 text-[11px] text-slate-500">Search uses Zoho’s search syntax across your mailbox.</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-slate-200">
              <input type="checkbox" ref={input => { if (input) input.indeterminate = checkedMessages.length > 0 && !allChecked; }} aria-label="Select all emails on this page" checked={allChecked} disabled={busy || loading || !messages.length} onChange={e => setCheckedIds(e.target.checked ? messages.map(message => message.messageId) : [])} className="h-5 w-5 accent-purple-500" />
              Select this page
            </label>
            <span role="status" className="text-slate-300">{checkedMessages.length} selected</span>
          </div>
          {checkedMessages.length > 0 && <fieldset disabled={busy || loading} aria-label="Bulk email actions" className="mt-2 space-y-2 rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void bulkAction('read')} className={button}>Mark read</button>
              <button type="button" onClick={() => void bulkAction('unread')} className={button}>Mark unread</button>
              <button type="button" onClick={() => void bulkAction('archive')} className={button}>Archive</button>
              <button type="button" disabled={!trashFolderId || checkedMessages.every(message => message.folderId === trashFolderId)} onClick={() => void bulkAction('trash')} className={`${button} text-red-300`}><Trash2 className="h-4 w-4" /> Delete selected</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Move selected emails to folder" value={bulkMoveFolder} onChange={e => setBulkMoveFolder(e.target.value)} className={`${control} min-w-0 flex-1`}>
                <option value="">Move selected to…</option>
                {folders.filter(item => checkedMessages.some(message => message.folderId !== item.folderId)).map(item => <option key={item.folderId} value={item.folderId}>{item.name}</option>)}
              </select>
              <button type="button" disabled={!bulkMoveFolder} onClick={() => void bulkAction('move')} className={button}>Move selected</button>
            </div>
            <button type="button" onClick={() => setCheckedIds([])} className={`${button} w-full`}>Clear selection</button>
            <p className="text-xs text-slate-300">Delete moves selected emails to Trash.</p>
          </fieldset>}
          {loading && <p role="status" className="p-4 text-sm text-slate-400">Loading from Zoho…</p>}{!loading && !error && !messages.length && <p className="p-4 text-sm text-slate-400">No messages in this view. Check Spam or open Zoho Mail if an expected email is missing.</p>}
          <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto">{messages.map(m => <div key={m.messageId} className={`flex items-start rounded-xl border ${selected?.messageId === m.messageId || checkedIds.includes(m.messageId) ? 'border-purple-400/40 bg-purple-500/15' : 'border-white/5 bg-slate-900/60 hover:bg-white/10'}`}>
            <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center pt-1">
              <input type="checkbox" aria-label={`Select email: ${m.subject}`} checked={checkedIds.includes(m.messageId)} disabled={busy || loading} onChange={e => setCheckedIds(ids => e.target.checked ? [...ids, m.messageId] : ids.filter(id => id !== m.messageId))} className="h-5 w-5 accent-purple-500" />
            </label>
            <button type="button" disabled={busy} onClick={() => void openMessage(m)} className="min-w-0 flex-1 p-3 pl-0 text-left"><span className="block truncate text-xs text-slate-400">{m.from}</span><span className={`mt-1 block break-words text-sm ${m.unread ? 'font-bold text-white' : 'text-slate-300'}`}>{m.subject}</span><span className="mt-1 block text-[11px] text-slate-500">{readableDate(m.receivedAt)}{m.hasAttachment ? ' · Attachment' : ''}</span></button>
          </div>)}</div>
          <div className="mt-3 flex items-center justify-between gap-2"><button disabled={start === 1 || loading || busy} onClick={() => setStart(s => Math.max(1, s - 30))} className={button}>Newer</button><span className="text-xs text-slate-500">Page {Math.floor((start - 1) / 30) + 1}</span><button disabled={!hasMore || loading || busy} onClick={() => setStart(s => s + 30)} className={button}>Older</button></div>
        </section>
        <section aria-label="Selected email" className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">{!selected ? <p className="py-16 text-center text-sm text-slate-400">Choose an email to read it here.</p> : <><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-bold">{selected.subject}</h2><button type="button" aria-label="Delete email (move to Trash)" title={trashFolderId ? "Move email to Trash" : "Refresh the mailbox to load the Trash folder"} disabled={busy || !trashFolderId || selected.folderId === trashFolderId} onClick={() => void messageAction('trash')} className={`${button} shrink-0 text-red-300 hover:text-red-200`}><Trash2 className="h-5 w-5" /></button></div><p className="mt-2 break-words text-xs text-slate-400">From: {selected.from}</p><p className="mt-1 break-words text-xs text-slate-400">To: {selected.to}</p><p className="mt-1 text-xs text-slate-500">{readableDate(selected.receivedAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy || reading || !detail || !selected.from || folders.find(f => f.folderId === selected.folderId)?.type?.toLowerCase() === 'drafts'} onClick={() => beginCompose({ ...emptyComposer, to: selected.from.match(/<([^>]+)>/)?.[1] || selected.from, subject: /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`, replyTo: selected.messageId })} className={button}>Reply</button><button disabled={busy} onClick={() => void messageAction(selected.unread ? 'read' : 'unread')} className={button}>{selected.unread ? 'Mark read' : 'Mark unread'}</button><button disabled={busy} onClick={() => void messageAction('archive')} className={button}>Archive</button><select aria-label="Move email to folder" value={moveFolder} onChange={e => setMoveFolder(e.target.value)} className={`${control} max-w-full`}><option value="">Move to…</option>{folders.filter(f => f.folderId !== selected.folderId).map(f => <option key={f.folderId} value={f.folderId}>{f.name}</option>)}</select><button disabled={busy || !moveFolder} onClick={() => void messageAction('move')} className={button}>Move</button></div>
          {reading && <p role="status" className="py-8 text-sm text-slate-400">Opening email from Zoho…</p>}{detail && <><p className="mt-4 text-[11px] text-slate-500">Images are displayed. Links open in a new tab. Active content is removed.</p><div className="mt-3 max-h-[600px] overflow-auto rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-900 [&_img]:max-w-full [&_img]:h-auto [&_a]:text-blue-700 [&_a]:underline [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:whitespace-pre-wrap [&_table]:max-w-full" dangerouslySetInnerHTML={{ __html: safeHtml }} /><div className="mt-3 flex flex-wrap gap-2">{detail.attachments.map(a => <button key={a.id} disabled={busy} onClick={() => void download(a)} className={`${button} max-w-full break-all`}><Paperclip className="h-4 w-4 shrink-0" />{a.name}</button>)}</div></>}
        </>}</section>
      </div>
    </>}{loading && !status && <p role="status" className="py-8 text-sm text-slate-400">Checking communications access…</p>}
  </main>;
}
