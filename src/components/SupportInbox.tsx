import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, RefreshCw, Copy, Mail } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

interface ContactRequest {
  id: string; name: string | null; email: string; category: string; subject: string; message: string;
  status: 'new' | 'in_progress' | 'answered' | 'closed'; response_text: string | null; created_at: string; archived_at: string | null;
}

export default function SupportInbox() {
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [contactReplies, setContactReplies] = useState<Record<string, string>>({});
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const loadGeneration = useRef(0);
  async function getAuthHeaders() {
    const client = getSupabaseClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session) throw new Error('Sign in to Q to use the support inbox.');
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  }
  async function parseJsonResponse(response: Response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to complete this support request.');
    return data;
  }
  const loadContactRequests = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/contact-requests?archived=${showArchived}`, { headers: await getAuthHeaders(), cache: 'no-store' });
      const payload = await parseJsonResponse(response);
      if (generation !== loadGeneration.current) return;
      setContactRequests(payload);
      setContactReplies(Object.fromEntries(payload.map((request: ContactRequest) => [request.id, request.response_text || ''])));
    } catch (error: any) { if (generation === loadGeneration.current) setContactMessage(error.message || 'Unable to load support requests.'); }
    finally { if (generation === loadGeneration.current) setLoading(false); }
  };

  const updateContactRequest = async (request: ContactRequest, status: ContactRequest['status']) => {
    setBusy(true);
    try {
      const responseText = contactReplies[request.id] || '';
      const response = await fetch(`/api/v1/admin/contact-requests/${request.id}`, { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ status, responseText }) });
      const updated = await parseJsonResponse(response);
      setContactRequests(current => current.map(item => item.id === updated.id ? updated : item));
      setContactMessage(`Support request marked ${status.replace('_', ' ')}.`);
    } catch (error: any) { setContactMessage(error.message || 'Unable to update support request.'); }
    finally { setBusy(false); }
  };

  const archiveContactRequest = async (request: ContactRequest) => {
    setBusy(true);
    try {
      const archived = !request.archived_at;
      const response = await fetch(`/api/v1/admin/contact-requests/${request.id}/archive`, {
        method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ archived }),
      });
      await parseJsonResponse(response);
      setContactRequests(current => current.filter(item => item.id !== request.id));
      setContactMessage(archived ? 'Support request archived. Find it in Archived.' : 'Support request restored to the inbox.');
    } catch (error: any) { setContactMessage(error.message || 'Unable to archive support request.'); }
    finally { setBusy(false); }
  };

  const openEmailReply = (request: ContactRequest) => {
    const body = contactReplies[request.id] || '';
    window.location.href = `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(`Re: ${request.subject}`)}&body=${encodeURIComponent(body)}`;
  };

  useEffect(() => {
    setContactRequests([]);
    setContactMessage(null);
    void loadContactRequests();
    return () => { loadGeneration.current++; };
  }, [showArchived]);
  return (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-white"><MessageSquareText className="h-4 w-4 text-sky-300" /><p className="text-sm font-semibold">Support inbox</p></div><p className="mt-1 text-sm text-slate-400">Questions sent from the login screen. Draft a response, open it in your staff email client, then update the CRM status.</p></div><button type="button" disabled={busy || loading} onClick={() => void loadContactRequests()} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/10" title="Refresh support inbox"><RefreshCw className="h-4 w-4" /></button></div>
          <div role="group" aria-label="Support request view" className="mt-4 flex gap-2">
            <button type="button" disabled={busy || loading} aria-pressed={!showArchived} onClick={() => setShowArchived(false)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-sky-200 disabled:opacity-40">Inbox</button>
            <button type="button" disabled={busy || loading} aria-pressed={showArchived} onClick={() => setShowArchived(true)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-sky-200 disabled:opacity-40">Archived</button>
          </div>
          {contactMessage && <p role="status" className="mt-3 rounded-xl bg-sky-500/10 p-3 text-xs text-sky-100">{contactMessage}</p>}
          <fieldset disabled={busy || loading} className="min-w-0">
          <div className="mt-4 space-y-3">
            {loading ? <p role="status" className="text-xs text-slate-400">Loading support requests…</p> : contactRequests.length === 0 ? <p className="text-xs text-slate-400">{showArchived ? 'No archived support requests.' : 'No support requests in the inbox.'}</p> : contactRequests.map(request => <article key={request.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-sky-300">{request.category}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.status === 'new' ? 'bg-amber-500/15 text-amber-200' : request.status === 'answered' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{request.status.replace('_', ' ')}</span></div><h3 className="mt-1 font-bold text-white">{request.subject}</h3><p className="mt-1 text-xs text-slate-400">{request.name || 'No name'} · {request.email} · {new Date(request.created_at).toLocaleString()}</p></div><button type="button" onClick={() => navigator.clipboard.writeText(request.email)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/10"><Copy className="h-3 w-3" />Email</button></div>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-200">{request.message}</p>
              <textarea value={contactReplies[request.id] || ''} onChange={event => setContactReplies({ ...contactReplies, [request.id]: event.target.value })} rows={4} placeholder="Draft the reply that will be sent by email…" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-xs text-white placeholder:text-slate-500" />
              <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => openEmailReply(request)} disabled={!contactReplies[request.id]?.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Mail className="h-3.5 w-3.5" />Open email reply</button><button type="button" onClick={() => void updateContactRequest(request, 'in_progress')} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10">In progress</button><button type="button" onClick={() => void updateContactRequest(request, 'answered')} disabled={!contactReplies[request.id]?.trim()} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Mark answered &amp; log reply</button><button type="button" onClick={() => void updateContactRequest(request, 'closed')} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white">Close</button></div>
              <button type="button" onClick={() => void archiveContactRequest(request)} className="mt-3 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-white/10">{request.archived_at ? 'Restore to inbox' : 'Archive'}</button>
            </article>)}
          </div>
          </fieldset>
        </section>
  );
}
