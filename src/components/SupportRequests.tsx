import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquareText, RefreshCw, Send, ArrowLeft } from 'lucide-react';
import { useCrmDraftState } from '../hooks/useCrmDraftState';
import SupportAttachments from './SupportAttachments';
import { supportApi } from '../services/support';
import { supportCategories, supportStatuses, supportStatusLabels, type SupportConversation, type SupportRequest } from '../shared/support';

const emptyRequest = { id: '', name: '', category: 'general', subject: '', message: '' };
type ReplyDraft = { id: string; body: string; internal: boolean };
const templates = [
  { label: 'Acknowledgement', body: 'Thank you for contacting Q. We are reviewing your request and will reply here when we have an update.' },
  { label: 'More information', body: 'Could you share the steps you took and the error message you saw? Please remove passwords, payment details and private personal content.' },
  { label: 'Resolution check', body: 'We have made an update to address this issue. Please try again and let us know whether it is working for you.' }
];

export default function SupportRequests({ staff = false, guest = false, initialRequestId = '', refreshToken=0 }: { staff?: boolean; guest?: boolean; initialRequestId?: string;refreshToken?:number }) {
  const base = staff ? '/staff/requests' : '/requests';
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [selected, setSelected] = useState(initialRequestId || (staff?new URLSearchParams(window.location.search).get('request')||'':''));
  const [ticketSearch,setTicketSearch]=useState('');const[dueFilter,setDueFilter]=useState('all');
  const [detail, setDetail] = useState<SupportConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useCrmDraftState('supportNewRequest', emptyRequest);
  const [replies, setReplies] = useCrmDraftState<Record<string, ReplyDraft>>('supportConversationReplies', {});
  const [legacyReplies, setLegacyReplies] = useCrmDraftState<Record<string,string>>('contactReplies', {});
  const [filters, setFilters] = useState({ status: '', category: '', assigned: '', archived: 'false' });
  const [assignees, setAssignees] = useState<{ id: string; label: string }[]>([]);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const mutation = useRef(false);
  const control = staff ? 'rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50' : 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50';
  const muted = staff ? 'text-slate-400' : 'text-slate-600';
  const card = staff ? 'rounded-2xl border border-white/10 bg-slate-900 p-4' : 'rounded-2xl border border-violet-200 bg-white p-4';
  const reply = replies[selected] || { id: '', body: staff ? legacyReplies[selected] || '' : '', internal: false };
  const report = (err: unknown) => setError(err instanceof Error ? err.message : 'Unable to complete this support request.');

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++generation.current; setLoading(true);
    try {
      const rows = await supportApi<SupportRequest[]>(`${base}${staff ? `?${new URLSearchParams(filters)}` : ''}`, { guest, signal });
      if (version === generation.current && !signal?.aborted) setRequests(rows);
    } catch (err) { if (version === generation.current && !signal?.aborted) report(err); }
    finally { if (version === generation.current && !signal?.aborted) setLoading(false); }
  }, [base, staff, guest, filters]);
  const loadDetail = useCallback(async (id: string, signal?: AbortSignal) => {
    const version = ++detailGeneration.current;
    const result = await supportApi<SupportConversation>(`${base}/${id}`, { guest, signal });
    if (version === detailGeneration.current && !signal?.aborted) setDetail(result);
  }, [base, guest]);
  useEffect(() => {
    const controller = new AbortController(); setError(''); void load(controller.signal);
    return () => { controller.abort(); generation.current++; };
  }, [load,refreshToken]);
  useEffect(() => {
    setDetail(null); setError(''); setNotice('');
    if (!selected) return;
    const controller = new AbortController();
    void loadDetail(selected, controller.signal).catch(err => { if (!controller.signal.aborted) report(err); });
    return () => { controller.abort(); detailGeneration.current++; };
  }, [selected, loadDetail]);
  useEffect(() => {
    if (!staff) return;
    const controller = new AbortController();
    void supportApi<{ id: string; label: string }[]>('/staff/assignees', { signal: controller.signal }).then(setAssignees).catch(err => { if (!controller.signal.aborted) report(err); });
    return () => controller.abort();
  }, [staff]);
  async function change(body: unknown) {
    if (mutation.current) return; mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await supportApi(`${base}/${selected}`, { guest, method: 'PATCH', body });
      setNotice('Support request updated.');
      await Promise.all([loadDetail(selected), load()]);
    } catch (err) { report(err); } finally { mutation.current = false; setBusy(false); }
  }
  async function sendReply(event: React.FormEvent) {
    event.preventDefault(); if (mutation.current) return; mutation.current = true; setBusy(true); setError(''); setNotice('');
    const submission = { ...reply, id: reply.id || crypto.randomUUID() }; setReplies(current => ({ ...current, [selected]: submission }));
    try {
      await supportApi(`${base}/${selected}/messages`, { guest, method: 'POST', body: { id: submission.id, body: submission.body, ...(staff ? { internal: submission.internal } : {}) } });
      setReplies(current => { const next = { ...current }; delete next[selected]; return next; });
      if (staff) setLegacyReplies(current => { const next = { ...current }; delete next[selected]; return next; });
      setNotice(submission.internal ? 'Internal note saved. Only support staff can see it.' : 'Reply saved in Q.');
      await Promise.all([loadDetail(selected), load()]);
    } catch (err) { report(err); } finally { mutation.current = false; setBusy(false); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (mutation.current) return; mutation.current = true; setBusy(true); setError(''); setNotice('');
    const submission = { ...draft, id: draft.id || crypto.randomUUID() }; setDraft(submission);
    try {
      const result = await supportApi<{ id: string }>(base, { method: 'POST', body: submission });
      setDraft(emptyRequest); setCreating(false); setSelected(result.id); await load();
    } catch (err) { report(err); } finally { mutation.current = false; setBusy(false); }
  }
  const editReply = (patch: Partial<ReplyDraft>) => setReplies(current => ({ ...current, [selected]: { ...(current[selected] || { id: '', body: staff ? legacyReplies[selected] || '' : '', internal: false }), ...patch, id: '' } }));
  const editNew = (patch: Partial<typeof emptyRequest>) => setDraft(current => ({ ...current, ...patch, id: '' }));
  async function retryNotification(messageId: string) {
    if (mutation.current || !window.confirm('Check the office Sent mailbox first. If this notification was already sent, retrying may send another email. Retry now?')) return;
    mutation.current=true;setBusy(true);setError('');
    try {
      await supportApi(`${base}/${selected}/notifications/${messageId}/retry`, { method:'POST',body:{checkedSent:true} });
      await loadDetail(selected);setNotice('Notification attempt recorded. Check its status below.');
    } catch(err) { report(err); } finally {mutation.current=false;setBusy(false);}
  }

  return <section aria-labelledby="q-support-heading" className={`${staff ? 'text-slate-100' : 'text-slate-900'} space-y-4`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="q-support-heading" className="flex items-center gap-2 text-xl font-bold"><MessageSquareText className="h-5 w-5" />{staff ? 'Tickets' : 'My requests'}</h2><p className={`mt-1 text-sm ${muted}`}>{staff ? 'Assign tickets, set priorities and due dates, and follow customer conversations.' : 'Ask about Q and follow your conversations with the support team.'}</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy || loading} className={control} onClick={() => { setError(''); void load(); if (selected) void loadDetail(selected).catch(report); }} aria-label="Refresh support"><RefreshCw className="h-4 w-4" /></button>{!staff && !guest && <button type="button" disabled={busy} className={control} onClick={() => { setCreating(true); setSelected(''); }}>{draft.subject || draft.message ? 'Resume draft' : 'New request'}</button>}</div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-900">{notice}</p>}
    {staff && <fieldset disabled={busy} className="flex flex-wrap gap-2">
      <label className="text-xs">View<select aria-label="Support view" className={`ml-2 ${control}`} value={filters.archived} onChange={event => setFilters(current => ({ ...current, archived: event.target.value }))}><option value="false">Active tickets</option><option value="true">Archived</option></select></label>
      <label className="text-xs">Status<select aria-label="Filter support status" className={`ml-2 ${control}`} value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{supportStatuses.map(status => <option key={status} value={status}>{status === 'waiting_for_user' ? 'Waiting for user' : supportStatusLabels[status]}</option>)}</select></label>
      <label className="text-xs">Topic<select aria-label="Filter support topic" className={`ml-2 ${control}`} value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}><option value="">All topics</option>{supportCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
      <label className="text-xs">Assigned<select aria-label="Filter support assignment" className={`ml-2 ${control}`} value={filters.assigned} onChange={event => setFilters(current => ({ ...current, assigned: event.target.value }))}><option value="">Anyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option></select></label>
    </fieldset>}
    {staff&&<div className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-xs">Search tickets<input aria-label="Search tickets" value={ticketSearch} onChange={e=>setTicketSearch(e.target.value)} placeholder="Subject, customer or reference" className={`mt-1 w-full ${control}`}/></label><label className="text-xs">Due date<select aria-label="Filter ticket due date" value={dueFilter} onChange={e=>setDueFilter(e.target.value)} className={`mt-1 block ${control}`}><option value="all">All dates</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="none">No due date</option></select></label></div>}
    {creating && <form onSubmit={create} className={`${card} space-y-4`}>
      <h3 className="font-bold">New support request</h3>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Name (optional)<input className={`mt-1 block w-full ${control}`} autoComplete="name" maxLength={120} value={draft.name} onChange={event => editNew({ name: event.target.value })} /></label>
        <label className="block text-sm">Topic<select className={`mt-1 block w-full ${control}`} value={draft.category} onChange={event => editNew({ category: event.target.value })}>{supportCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="block text-sm">Subject<input required minLength={3} maxLength={160} className={`mt-1 block w-full ${control}`} value={draft.subject} onChange={event => editNew({ subject: event.target.value })} /></label>
        <label className="block text-sm">Message<textarea required minLength={10} maxLength={5000} rows={5} className={`mt-1 block w-full ${control}`} value={draft.message} onChange={event => editNew({ message: event.target.value })} /></label>
        <p className={`text-xs ${muted}`}>Share only what is needed for product or account support. Do not include passwords, payment details or private journal content. This is not an emergency service. No response time is guaranteed.</p>
        <div className="flex gap-2"><button type="submit" className={control}>{busy ? 'Saving…' : 'Submit request'}</button><button type="button" className={control} onClick={() => setCreating(false)}>Keep draft and close</button></div>
      </fieldset>
    </form>}
    <div className={staff?"space-y-5":"grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]"}>
      <div className="min-w-0 space-y-2" aria-label="Support requests">
        {loading && <p role="status" className={`text-sm ${muted}`}>Loading requests…</p>}
        {!loading && !requests.length && <p className={`text-sm ${muted}`}>{staff ? 'No requests match this view.' : 'No requests yet. Questions submitted while signed out require an email access link.'}</p>}
        {staff&&<div className="overflow-x-auto rounded-xl border border-slate-700"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-900 text-xs text-slate-400"><tr>{['Ticket / customer','Status','Assigned to','Priority','Due date',''].map((label,i)=><th key={i} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{requests.filter(r=>[r.subject,r.email,r.name,r.id].join(' ').toLowerCase().includes(ticketSearch.trim().toLowerCase())&&(dueFilter==='all'||dueFilter==='none'&&!r.due_at||dueFilter==='overdue'&&!!r.due_at&&Date.parse(r.due_at)<Date.now()&&!['resolved','closed'].includes(r.status)||dueFilter==='today'&&!!r.due_at&&new Date(r.due_at).toDateString()===new Date().toDateString())).map(r=><tr key={r.id} className={selected===r.id?'bg-violet-500/10':'hover:bg-slate-900/70'}><td className="max-w-xs p-3"><p className="break-words font-semibold text-white">{r.subject}</p><p className="mt-1 break-all text-xs text-slate-400">{r.email||r.name||r.id.slice(0,8)}</p></td><td className="p-3 text-xs">{r.status==='waiting_for_user'?'Waiting for customer':supportStatusLabels[r.status]}</td><td className="p-3 text-xs">{assignees.find(a=>a.id===r.assigned_to)?.label||'Unassigned'}</td><td className="p-3 text-xs capitalize">{r.priority||'normal'}</td><td className={`p-3 text-xs ${r.due_at&&Date.parse(r.due_at)<Date.now()&&!['resolved','closed'].includes(r.status)?'text-rose-300':'text-slate-400'}`}>{r.due_at?new Date(r.due_at).toLocaleString():'No due date'}</td><td className="p-3"><button disabled={busy} onClick={()=>setSelected(r.id)} className={control}>Open ticket</button></td></tr>)}</tbody></table></div>}
        {!staff&&requests.map(request => <button key={request.id} type="button" disabled={busy} aria-pressed={selected === request.id} onClick={() => { setSelected(request.id); setCreating(false); }} className={`${card} w-full text-left ${selected === request.id ? 'ring-2 ring-violet-500' : ''} disabled:opacity-50`}>
          <span className="block break-words text-sm font-bold">{request.subject}</span><span className={`mt-1 block text-xs ${muted}`}>{supportStatusLabels[request.status]} · {request.category}</span><time className={`mt-2 block text-xs ${muted}`} dateTime={request.updated_at}>Last activity {new Date(request.updated_at).toLocaleString()}</time>
        </button>)}
        {requests.length === 200 && <p className={`text-xs ${muted}`}>Showing the 200 most recently updated requests.{staff ? ' Use filters to narrow the list.' : ''}</p>}
      </div>
      <div className="min-w-0">
        {selected && !detail && !error && <p role="status">Loading conversation…</p>}
        {!selected && !creating && <p className={`text-sm ${muted}`}>Select a ticket to read the conversation.</p>}
        {detail && <article className={`${card} space-y-4`}>
          <button type="button" disabled={busy} className={control} onClick={() => setSelected('')}><ArrowLeft className="mr-1 inline h-4 w-4" />Back to requests</button>
          <div><h3 className="break-words text-lg font-bold">{detail.request.subject}</h3><p className={`mt-1 text-xs ${muted}`}>{supportStatusLabels[detail.request.status]} · Reference {detail.request.id}</p>{staff && <p className={`mt-1 break-words text-xs ${muted}`}>{detail.request.name || 'No name'} · {detail.request.email}</p>}</div>
          <fieldset disabled={busy} className="flex flex-wrap gap-2">
            {staff ? <><label className="text-xs">Status<select aria-label="Request status" className={`ml-2 ${control}`} value={detail.request.status} onChange={event => void change({ action: 'status', status: event.target.value })}>{supportStatuses.map(status => <option key={status} value={status}>{status === 'waiting_for_user' ? 'Waiting for user' : supportStatusLabels[status]}</option>)}</select></label><label className="text-xs">Assigned to<select aria-label="Assign request" className={`ml-2 ${control}`} value={detail.request.assigned_to || ''} onChange={event => void change({ action: 'assignment', assignedTo: event.target.value || null })}><option value="">Unassigned</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label><label className="text-xs">Priority<select aria-label="Ticket priority" className={`ml-2 ${control}`} value={detail.request.priority||'normal'} onChange={e=>void change({action:'priority',priority:e.target.value})}>{['low','normal','high','urgent'].map(p=><option key={p}>{p}</option>)}</select></label><label className="text-xs">Due date<input aria-label="Ticket due date" key={`${detail.request.id}:${detail.request.due_at||''}`} type="datetime-local" className={`ml-2 ${control}`} defaultValue={detail.request.due_at?new Date(Date.parse(detail.request.due_at)-new Date(detail.request.due_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''} onBlur={e=>{const value=e.target.value?new Date(e.target.value).toISOString():null;if(value!==(detail.request.due_at||null))void change({action:'due',dueAt:value});}}/></label><button type="button" className={control} onClick={() => void change({ action: detail.request.archived_at ? 'restore' : 'archive' })}>{detail.request.archived_at ? 'Restore' : 'Archive'}</button></> : <button type="button" className={control} onClick={() => void change({ status: ['resolved','closed'].includes(detail.request.status) ? 'in_progress' : 'closed' })}>{['resolved','closed'].includes(detail.request.status) ? 'Reopen request' : 'Close request'}</button>}
          </fieldset>
          <div className="space-y-3" aria-label="Conversation history" data-no-translate>
            <div className={`rounded-xl p-3 ${staff ? 'bg-slate-800' : 'bg-slate-100'}`}><p className={`text-xs ${muted}`}>Original request · {new Date(detail.request.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{detail.request.message}</p></div>
            {detail.messages.map(message => <div key={message.id} className={`rounded-xl p-3 ${message.internal ? 'border border-amber-400/40 bg-amber-500/10' : message.author_kind === 'staff' ? (staff ? 'bg-violet-950' : 'bg-violet-50') : (staff ? 'bg-slate-800' : 'bg-slate-100')}`}>
              <p className={`text-xs ${muted}`}>{message.internal ? 'Internal staff note' : message.author_kind === 'staff' ? 'Q support' : staff ? 'Requester' : 'You'} · {new Date(message.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
              {staff && message.author_kind === 'staff' && !message.internal && <p className={`mt-2 text-xs ${muted}`}>{message.notification_status === 'sent' ? 'Notification accepted by the email provider.' : message.notification_status === 'failed' ? 'Email notification failed or delivery is uncertain. The reply is saved in Q. Check the office Sent mailbox before contacting the user again.' : message.notification_status === 'unavailable' ? 'Email notification unavailable. Ask an admin to configure the office mailbox. The reply is saved in Q.' : message.notification_status ? 'Email notification pending or awaiting confirmation.' : 'Historical reply; email delivery was not verified.'}</p>}
              {staff && message.notification_status && message.notification_status !== 'sent' && <button type="button" disabled={busy} className={`mt-2 ${control}`} onClick={() => void retryNotification(message.id)}>Retry email notification</button>}
            </div>)}
          </div>
          {staff&&detail.request.user_id&&<a href={`/crm?customer=${detail.request.user_id}`} className="inline-block text-sm text-violet-300 underline">Open customer 360 record</a>}
          {staff&&detail.request.email_message_id&&<div className="rounded-lg bg-sky-500/10 p-3 text-sm"><p>This ticket came from an office email. Open the linked message to read the original and send an email reply. Replies below are saved in Q and send a generic notice.</p><a className="mt-2 inline-block text-sky-300 underline" href={`/crm/comms?section=mail&account=${detail.request.email_account_id}&folder=${detail.request.email_folder_id}&message=${detail.request.email_message_id}`}>Open original office email</a></div>}
          <SupportAttachments key={detail.request.id} requestId={detail.request.id} staff={staff} guest={guest} disabled={busy} onBusy={setBusy} />
          <form onSubmit={sendReply} className="space-y-3"><fieldset disabled={busy} className="space-y-3">
            {staff && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reply.internal} onChange={event => editReply({ internal: event.target.checked })} />Internal note (staff only)</label><label className="block text-xs">Response template<select aria-label="Response template" value="" onChange={event => { const template = templates[Number(event.target.value)]; if (template) editReply({ body: reply.body ? `${reply.body}\n\n${template.body}` : template.body }); }} className={`ml-2 ${control}`}><option value="">Add a template…</option>{templates.map((template,index) => <option key={template.label} value={index}>{template.label}</option>)}</select></label></>}
            <label className="block text-sm">{reply.internal ? 'Internal note' : 'Reply'}<textarea required maxLength={5000} rows={4} value={reply.body} onChange={event => editReply({ body: event.target.value })} className={`mt-1 block w-full ${control}`} /></label>
            <button type="submit" disabled={!reply.body.trim() || busy} className={control}><Send className="mr-2 inline h-4 w-4" />{busy ? 'Saving…' : reply.internal ? 'Save internal note' : 'Send reply'}</button>
            <p className={`text-xs ${muted}`}>{staff ? 'Customer replies are saved in Q; a separate email notification contains only a link.' : 'Your reply is shared with Q support. Replying reopens a resolved or closed request.'}</p>
          </fieldset></form>
          {staff && !!detail.events.length && <details><summary className="cursor-pointer text-sm">Request activity</summary><ol className={`mt-2 space-y-1 text-xs ${muted}`}>{detail.events.map(event => <li key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.action} · {event.status.replaceAll('_',' ')} · {event.actor_id ? `Account ${event.actor_id.slice(0,8)}` : 'Email access'}{event.action === 'assignment' ? ` → ${assignees.find(person => person.id === event.assigned_to)?.label || 'Unassigned'}` : ''}</li>)}</ol></details>}
        </article>}
      </div>
    </div>
  </section>;
}
