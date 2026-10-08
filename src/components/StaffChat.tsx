import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Volume2, VolumeX } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

type Message = { id: number; user_id: string; recipient_id: string | null; display_name: string; role: string; body: string; created_at: string };
type Member = { id: string; name: string; role: string };
const control = 'min-h-11 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50';

export default function StaffChat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
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
  const recipientName = team.find(member => member.id === recipient)?.name || 'Team member';
  const unreadCount = Object.values(unread).reduce((total, count) => total + count, 0);
  const draftKey = (target: string) => `q-team-chat-draft:${userId}${target ? ':' + target : ''}`;
  function chooseConversation(target: string) {
    if (busy) return;
    setRecipient(target); setOpen(true); setToast('');
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
  useEffect(() => {
    const client = getSupabaseClient(); if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, value) => setUserId(value?.user.id || null));
    return () => { data.subscription.unsubscribe(); void audio.current?.close(); };
  }, []);
  useEffect(() => {
    setAllowed(false); setMessages([]); setMembers([]); setTeam([]); setRecipient(''); setUnread({}); setOpen(false); setToast(''); setError(''); setConnected(false); cursor.current = undefined;
    if (!userId) return;
    const controller = new AbortController(); let timer: number; let toastTimer: number; let running = false; let authorised = false; let denied = false;
    const key = `q-team-chat-draft:${userId}`;
    try { setDraft(sessionStorage.getItem(key) || ''); } catch { setDraft(''); }
    async function sync() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        if (!authorised) {
          const me = await request('/api/v1/admin/me', undefined, controller.signal);
          authorised = ['staff', 'partner_admin'].includes(me.role);
          if (!authorised) return;
          setAllowed(true);
        }
        const data = await request('/api/staff-chat/sync', { session: session.current, cursor: cursor.current }, controller.signal);
        if (controller.signal.aborted) return;
        const incoming: Message[] = data.messages;
        const fresh = cursor.current !== undefined ? incoming.filter(message => message.user_id !== userId) : [];
        if (incoming.length) {
          cursor.current = String(incoming[incoming.length - 1].id);
          setMessages(previous => [...new Map([...previous, ...incoming].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id).slice(-500));
        } else if (cursor.current === undefined) cursor.current = '0';
        setMembers(data.users); setTeam(data.team); setError(''); setConnected(true);
        if (fresh.length) {
          const unseen = fresh.filter(message => !openRef.current || document.hidden || conversationKey(message) !== recipientRef.current);
          if (unseen.length) {
            setUnread(previous => { const next = { ...previous }; for (const message of unseen) { const key = conversationKey(message); next[key] = (next[key] || 0) + 1; } return next; });
            const latest = unseen[unseen.length - 1]; toastRecipient.current = conversationKey(latest);
            setToast(`${latest.recipient_id ? 'Private message' : 'Everyone'} · ${latest.display_name}: ${latest.body.slice(0, 120)}`);
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
  if (!allowed) return null;
  return <div className="fixed bottom-5 right-5 z-[120] text-slate-100">
    {toast && <button onClick={() => chooseConversation(toastRecipient.current)} role="status" className="mb-3 block w-80 max-w-[calc(100vw-40px)] rounded-xl border border-violet-400/40 bg-slate-900 p-4 text-left text-sm shadow-xl"><strong className="block text-violet-300">New message</strong>{toast}</button>}
    {open && <section aria-label="Staff and Admin team chat" className="mb-3 flex h-[min(650px,75dvh)] w-[min(520px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold">Team chat</h2><p className="text-xs text-slate-400">Staff & Admins · {connected ? 'Connected' : 'Reconnecting…'}</p></div><button aria-label="Close team chat" className={control} onClick={() => setOpen(false)}><X size={18} /></button></header>
      <div className="border-b border-slate-800 p-3"><label htmlFor="team-recipient" className="mb-2 block text-xs text-slate-400">Conversation</label><select id="team-recipient" disabled={busy} value={recipient} onChange={event => chooseConversation(event.target.value)} className="min-h-11 w-full rounded-lg bg-slate-800 px-3 text-sm"><option value="">Everyone{unread[''] ? ` (${unread['']} unread)` : ''}</option>{team.filter(member => member.id !== userId).map(member => <option key={member.id} value={member.id}>{member.name} · {member.role === 'partner_admin' ? 'Admin' : 'Staff'}{members.some(online => online.id === member.id) ? ' · Online' : ' · Offline'}{unread[member.id] ? ` (${unread[member.id]} unread)` : ''}</option>)}</select><p className="mt-2 text-xs text-violet-300">{recipient ? `Private conversation with ${recipientName}. Only you and the recipient can access these messages in Q.` : 'Messages here are shared with all Staff and Admins.'}</p></div>
      <div className="border-b border-slate-800 p-3"><p className="mb-2 text-xs text-emerald-300">Online ({members.length})</p><ul className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">{members.map(member => <li key={member.id} className="rounded-full bg-slate-800 px-3 py-1 text-xs"><span className="text-emerald-400">● </span>{member.name}{member.id === userId ? ' (you)' : ''} · {member.role === 'partner_admin' ? 'Admin' : 'Staff'}</li>)}</ul></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label={recipient ? 'Private messages' : 'Team messages'}>{historyLoading && <p role="status" className="text-sm text-slate-400">Loading conversation…</p>}{!historyLoading && !visibleMessages.length && <p className="text-sm text-slate-400">{recipient ? `Send a private message to ${recipientName}.` : 'Start a conversation with everyone.'}</p>}{visibleMessages.map(message => <article key={message.id} className={`rounded-xl p-3 ${message.user_id === userId ? 'ml-8 bg-violet-600/25' : 'mr-8 bg-slate-800'}`}><p className="text-xs text-violet-300">{message.display_name} · {message.role === 'partner_admin' ? 'Admin' : 'Staff'} <time className="text-slate-400" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p></article>)}<div ref={end} /></div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-rose-300">{error} <button className="underline" onClick={() => void refresh.current()}>Retry</button></p>}
      <form onSubmit={send} className="border-t border-slate-800 p-3"><label className="sr-only" htmlFor="team-message">Message your team</label><textarea id="team-message" value={draft} disabled={busy} maxLength={2000} rows={2} onChange={event => { setDraft(event.target.value); requestId.current = crypto.randomUUID(); try { sessionStorage.setItem(draftKey(recipient), event.target.value); } catch {} }} placeholder={recipient ? `Private message to ${recipientName}…` : 'Message everyone…'} className="w-full resize-none rounded-lg bg-slate-900 p-3 text-sm"/><div className="mt-2 flex items-center justify-between gap-2"><button type="button" className={control} aria-pressed={sound} onClick={async () => { if (sound) { setSound(false); return; } try { audio.current ||= new AudioContext(); await audio.current.resume(); setSound(true); ping(); } catch { setError('Your browser could not enable sound.'); } }}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{sound ? ' Sound on' : ' Enable sound'}</button><span className="text-xs text-slate-500">{draft.length}/2000</span><button disabled={busy || !draft.trim()} className={`${control} bg-violet-600`}><Send size={16} />{busy ? 'Sending…' : 'Send'}</button></div></form>
    </section>}
    <button onClick={() => setOpen(value => !value)} aria-expanded={open} className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-violet-600 px-5 py-3 font-semibold shadow-lg"><MessageCircle size={20} />Team chat{unreadCount > 0 && <span className="rounded-full bg-rose-600 px-2 text-sm">{unreadCount}</span>}</button>
  </div>;
}

