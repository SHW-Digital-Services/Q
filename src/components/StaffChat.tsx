import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Volume2, VolumeX } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';
import { staffChatName } from '../shared/staffChatName';
import { systemNotificationsSupported, systemNotificationsEnabled, enableSystemNotifications, disableSystemNotifications, notifyStaffChat } from '../services/staffChatNotifications';

type Message = { id: number; user_id: string; recipient_id: string | null; display_name: string; role: string; body: string; created_at: string };
type Member = { id: string; name: string; role: string };
const control = 'min-h-11 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50';

export default function StaffChat({ page = true }: { page?: boolean }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [canPurge, setCanPurge] = useState(false);
  const open = page;
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [recipient, setRecipient] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [toast, setToast] = useState('');
  const [sound, setSound] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [systemBusy, setSystemBusy] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const openRef = useRef(open); openRef.current = open;
  const recipientRef = useRef(recipient); recipientRef.current = recipient;
  const toastRecipient = useRef('');
  const soundRef = useRef(sound); soundRef.current = sound;
  const cursor = useRef<string | undefined>(undefined);
  const session = useRef(crypto.randomUUID());
  const requestId = useRef(crypto.randomUUID());
  const end = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => Promise<void>>(async () => {});
  const conversationKey = (message: Message) => message.recipient_id ? (message.user_id === userId ? message.recipient_id : message.user_id) : '';
  const visibleMessages = messages.filter(message => conversationKey(message) === recipient);
  const selectedMember = team.find(member => member.id === recipient);
  const recipientName = staffChatName(selectedMember?.name, selectedMember?.role || 'staff');
  const unreadCount = Object.values(unread).reduce((total, count) => total + count, 0);
  const draftKey = (target: string) => `q-team-chat-draft:${userId}${target ? ':' + target : ''}`;
  function chooseConversation(target: string) {
    if (!page) { window.location.assign(`/crm/chat${target ? '?recipient=' + encodeURIComponent(target) : ''}`); return; }
    if (busy) return;
    setRecipient(target); setToast(''); setShowChatOptions(false);
    setUnread(previous => ({ ...previous, [target]: 0 }));
    requestId.current = crypto.randomUUID();
    try { setDraft(sessionStorage.getItem(draftKey(target)) || ''); } catch { setDraft(''); }
  }

  async function request(path: string, body?: unknown, signal?: AbortSignal) {
    const auth = await getSupabaseClient()?.auth.getSession();
    if (!auth?.data.session) throw Error('Please sign in again.');
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', signal, cache: 'no-store', headers: { Authorization: `Bearer ${auth.data.session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result.error || 'Chat is unavailable.'), { status: response.status });
    return result;
  }
  function ping() {
    const ctx = audio.current; if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(740, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.26);
  }
  async function toggleSound() {
    if (sound) {
      setSound(false);
      try { localStorage.setItem(`q-team-chat-sound:${userId}`, 'off'); } catch {}
      return;
    }
    try {
      audio.current ||= new AudioContext(); await audio.current.resume(); setSound(true); ping();
      try { localStorage.setItem(`q-team-chat-sound:${userId}`, 'on'); } catch {}
    } catch { setError('Your browser could not enable sound.'); }
  }
  async function toggleSystemNotifications() {
    if (!userId) return;
    setSystemBusy(true);
    try {
      if (systemNotificationsEnabled(userId)) { disableSystemNotifications(userId); setSystemEnabled(false); }
      else { await enableSystemNotifications(userId); setSystemEnabled(true); }
      setError('');
    } catch (e: any) { setError(e.message); } finally { setSystemBusy(false); }
  }
  useEffect(() => {
    const update = () => setSystemEnabled(userId ? systemNotificationsEnabled(userId) : false);
    update(); window.addEventListener('focus', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('focus', update); window.removeEventListener('storage', update); };
  }, [userId]);
  useEffect(() => {
    setSound(false);
    if (!userId) return;
    let active = true;
    const unlock = () => {
      try { if (localStorage.getItem(`q-team-chat-sound:${userId}`) !== 'on') return; } catch { return; }
      audio.current ||= new AudioContext();
      void audio.current.resume().then(() => { if (active) setSound(true); }).catch(() => {});
    };
    unlock();
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    return () => { active = false; document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [userId]);
  useEffect(() => {
    const client = getSupabaseClient(); if (!client) return;
    const updateAccount = (value: { user: { id: string } } | null) => { setUserId(value?.user.id || null); };
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, value) => { if (active) updateAccount(value); });
    void client.auth.getSession().then(({ data }) => { if (active) updateAccount(data.session); });
    return () => { active = false; data.subscription.unsubscribe(); void audio.current?.close(); };
  }, []);
  useEffect(() => {
    const linkedRecipient = page ? new URLSearchParams(window.location.search).get('recipient') || '' : '';
    setAllowed(false); setCanPurge(false); setMessages([]); setMembers([]); setTeam([]); setRecipient(linkedRecipient); setUnread({}); setToast(''); setError(''); setConnected(false); cursor.current = undefined;
    if (!userId) return;
    const controller = new AbortController(); let timer: number; let toastTimer: number; let running = false; let authorised = false; let denied = false;
    const key = `q-team-chat-draft:${userId}${linkedRecipient ? ':' + linkedRecipient : ''}`;
    try { setDraft(sessionStorage.getItem(key) || ''); } catch { setDraft(''); }
    async function sync() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        if (!authorised) {
          const me = await request('/api/v1/admin/me', undefined, controller.signal);
          authorised = ['staff', 'partner_admin'].includes(me.role);
          if (!authorised) return;
          setCanPurge(me.role === 'partner_admin');
          setAllowed(true);
        }
        const data = await request('/api/staff-chat/sync', { session: session.current, cursor: cursor.current }, controller.signal);
        if (controller.signal.aborted) return;
        if (data.userId !== userId) throw Error('Your signed-in account changed. Refresh Team chat to reconnect with the current account.');
        const incoming: Message[] = data.messages;
        const publicMessages: Message[] = data.publicMessages || [];
        const fresh = cursor.current !== undefined ? incoming.filter(message => message.user_id !== userId) : [];
        if (incoming.length) {
          cursor.current = String(incoming[incoming.length - 1].id);
          setMessages(previous => [...new Map([...previous.filter(message => message.recipient_id !== null), ...publicMessages, ...incoming].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id).slice(-500));
        } else {
          setMessages(previous => [...new Map([...previous.filter(message => message.recipient_id !== null), ...publicMessages].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id).slice(-500));
          if (cursor.current === undefined) cursor.current = '0';
        }
        setMembers(data.users); setTeam(data.team); setError(''); setConnected(true);
        if (fresh.length) {
          const unseen = fresh.filter(message => !openRef.current || document.hidden || conversationKey(message) !== recipientRef.current);
          if (unseen.length) {
            setUnread(previous => { const next = { ...previous }; for (const message of unseen) { const key = conversationKey(message); next[key] = (next[key] || 0) + 1; } return next; });
            const latest = unseen[unseen.length - 1]; toastRecipient.current = conversationKey(latest);
            const target = conversationKey(latest);
            void notifyStaffChat(userId!, latest.id, target, Boolean(latest.recipient_id), () => chooseConversation(target));
            setToast(`${latest.recipient_id ? 'Private message' : 'Everyone'} · ${staffChatName(latest.display_name, latest.role)}: ${latest.body.slice(0, 120)}`);
            window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => setToast(''), 6000);
          }
          if (soundRef.current) ping();
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        if (e.status === 401 || e.status === 403) { authorised = false; denied = true; setAllowed(false); setMessages([]); setMembers([]); return; }
        setError(e.message); setConnected(false); setMembers([]);
      } finally {
        running = false;
        if (!controller.signal.aborted && !denied) timer = window.setTimeout(() => void sync(), 8000);
      }
    }
    refresh.current = async () => { window.clearTimeout(timer); await sync(); };
    void sync();
    const visible = () => { if (!document.hidden) { if (openRef.current) setUnread(previous => ({ ...previous, [recipientRef.current]: 0 })); void refresh.current(); } };
    document.addEventListener('visibilitychange', visible);
    return () => {
      controller.abort(); window.clearTimeout(timer); window.clearTimeout(toastTimer); document.removeEventListener('visibilitychange', visible);
      if (authorised) void request('/api/staff-chat/leave', { session: session.current }).catch(() => {});
    };
  }, [userId]);
  useEffect(() => { if (open && !document.hidden) { setUnread(previous => ({ ...previous, [recipient]: 0 })); end.current?.scrollIntoView({ block: 'nearest' }); } }, [open, messages, recipient]);
  useEffect(() => {
    if (!allowed || !open) return;
    const controller = new AbortController(); setHistoryLoading(true);
    void request('/api/staff-chat/history', { recipient: recipient || null }, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setMessages(previous => [...new Map([...previous, ...data.messages].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id).slice(-500));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [allowed, open, recipient]);
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (busy || !draft.trim()) return;
    setBusy(true);
    try {
      await request('/api/staff-chat/messages', { body: draft, id: requestId.current, recipient: recipient || null });
      setDraft(''); requestId.current = crypto.randomUUID();
      try { sessionStorage.removeItem(draftKey(recipient)); } catch {}
      await refresh.current();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function purgePublicChat() {
    if (!canPurge || busy || !window.confirm('Permanently delete every message in the public Everyone chat? Private messages will be kept.')) return;
    setBusy(true);
    try {
      await request('/api/staff-chat/purge-public', {});
      setMessages(previous => previous.filter(message => message.recipient_id !== null));
      setUnread(previous => ({ ...previous, '': 0 }));
      setError('');
      await refresh.current();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  if (!allowed) return page ? <p role="status" className="text-slate-400">{error || 'Checking team chat access…'}</p> : null;
  if (!page) return toast ? <button onClick={() => chooseConversation(toastRecipient.current)} role="status" className="fixed bottom-5 right-5 z-[120] w-80 max-w-[calc(100vw-40px)] rounded-xl border border-violet-400/40 bg-slate-900 p-4 text-left text-sm text-slate-100 shadow-xl"><strong className="block text-violet-300">New message</strong>{toast}</button> : null;
  return <div className="w-full min-w-0 text-slate-100">
    {toast && <button onClick={() => chooseConversation(toastRecipient.current)} role="status" className="fixed bottom-5 right-5 z-[120] w-80 max-w-[calc(100vw-40px)] rounded-xl border border-violet-400/40 bg-slate-900 p-4 text-left text-sm shadow-xl"><strong className="block text-violet-300">New message</strong>{toast}</button>}
    <section aria-label="Staff and Admin team chat" className="flex h-[max(680px,calc(100dvh-64px))] w-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-6"><div><h1 className="text-xl font-bold">Team chat</h1><p className="mt-1 text-xs text-slate-400">{recipient ? `Private · ${recipientName}` : 'Everyone'} · {connected ? 'Connected' : 'Reconnecting…'}</p></div><div className="flex items-center gap-2">{unreadCount > 0 && <span className="rounded-full bg-rose-600 px-3 py-1 text-sm">{unreadCount} unread</span>}{canPurge && <button type="button" disabled={busy} onClick={() => void purgePublicChat()} className={`${control} border-rose-400/40 text-rose-200`}><Trash2 size={16} /> Purge public chat</button>}<button type="button" aria-expanded={showChatOptions} aria-controls="team-chat-options" onClick={() => setShowChatOptions(value => !value)} className={`${control} lg:hidden`}>Conversations & options</button></div></header>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside id="team-chat-options" aria-label="Chat options and team members" className={`${showChatOptions ? 'block' : 'hidden'} max-h-[40dvh] shrink-0 overflow-y-auto border-b border-slate-800 bg-slate-900/40 lg:block lg:max-h-none lg:border-b-0 lg:border-r`}>
      <div className="border-b border-slate-800 px-4 py-3"><button type="button" disabled={systemBusy || !systemNotificationsSupported()} aria-pressed={systemEnabled} onClick={() => void toggleSystemNotifications()} className={control}>{systemBusy ? 'Checking permission…' : systemEnabled ? 'System notifications on · turn off' : 'Enable system notifications'}</button><p className="mt-2 text-xs text-slate-400">{systemNotificationsSupported() ? 'Alerts appear in your device’s notification centre while Q is open, including when it is in the background. Message text stays hidden in system alerts.' : 'System notifications are unavailable in this browser. In-app alerts still work.'}</p></div>
      <div className="border-b border-slate-800 p-3"><label htmlFor="team-recipient" className="mb-2 block text-xs text-slate-400">Conversation</label><select id="team-recipient" disabled={busy} value={recipient} onChange={event => chooseConversation(event.target.value)} className="min-h-11 w-full rounded-lg bg-slate-800 px-3 text-sm"><option value="">Everyone{unread[''] ? ` (${unread['']} unread)` : ''}</option>{team.filter(member => member.id !== userId).map(member => <option key={member.id} value={member.id}>{staffChatName(member.name, member.role)}{members.some(online => online.id === member.id) ? ' · Online' : ' · Offline'}{unread[member.id] ? ` (${unread[member.id]} unread)` : ''}</option>)}</select><p className="mt-2 text-xs text-violet-300">{recipient ? `Private conversation with ${recipientName}. Only you and the recipient can access these messages in Q.` : 'Messages here are shared with all Staff and Admins.'}</p></div>
      <div className="border-b border-slate-800 p-3"><p className="mb-2 text-xs text-emerald-300">Online ({members.length})</p><ul className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">{members.map(member => <li key={member.id} className="rounded-full bg-slate-800 px-3 py-1 text-xs"><span className="text-emerald-400">● </span>{staffChatName(member.name, member.role)}{member.id === userId ? ' (you)' : ''}</li>)}</ul></div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label={recipient ? 'Private messages' : 'Team messages'}>{historyLoading && <p role="status" className="text-sm text-slate-400">Loading conversation…</p>}{!historyLoading && !visibleMessages.length && <p className="text-sm text-slate-400">{recipient ? `Send a private message to ${recipientName}.` : 'Start a conversation with everyone.'}</p>}{visibleMessages.map(message => <article key={message.id} className={`rounded-xl p-3 ${message.user_id === userId ? 'ml-8 bg-violet-600/25' : 'mr-8 bg-slate-800'}`}><p className="text-xs text-violet-300">{staffChatName(message.display_name, message.role)} <time className="text-slate-400" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p></article>)}<div ref={end} /></div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-rose-300">{error} <button className="underline" onClick={() => void refresh.current()}>Retry</button></p>}
      <form onSubmit={send} className="border-t border-slate-800 p-3"><label className="sr-only" htmlFor="team-message">Message your team</label><textarea id="team-message" value={draft} disabled={busy} maxLength={2000} rows={2} onChange={event => { setDraft(event.target.value); requestId.current = crypto.randomUUID(); try { sessionStorage.setItem(draftKey(recipient), event.target.value); } catch {} }} placeholder={recipient ? `Private message to ${recipientName}…` : 'Message everyone…'} className="w-full resize-none rounded-lg bg-slate-900 p-3 text-sm"/><div className="mt-2 flex items-center justify-between gap-2"><button type="button" className={control} aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{sound ? ' Sound on' : ' Enable sound'}</button><span className="text-xs text-slate-500">{draft.length}/2000</span><button disabled={busy || !draft.trim()} className={`${control} bg-violet-600`}><Send size={16} />{busy ? 'Sending…' : 'Send'}</button></div></form>
      </div>
      </div>
    </section>
  </div>;
}
