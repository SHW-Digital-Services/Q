import React, { useEffect, useState } from 'react';
import { Settings, ShieldCheck, RefreshCw, KeyRound, Search, Users, UserCheck, CreditCard, LogIn, Package, Plus, X, ExternalLink, ClipboardList, UserCog, UserPlus, MessageSquareText, Mail, Copy } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';

interface AdminPanelProps {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  onClose: () => void;
}

interface CrmUser {
  id: string;
  email: string;
  name: string;
  role: string;
  signupAt: string;
  lastLoginAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  subscription: null | {
    status: string;
    planId: string;
    providerId: string;
    currentPeriodEnd: string | null;
    updatedAt: string;
  };
}

interface CrmProduct {
  id: string; name: string; description: string | null; price_minor: number; currency: string;
  billing_interval: 'one_time' | 'month' | 'year'; paypal_product_id: string | null; paypal_plan_id: string | null;
  paypal_sync_status: 'not_synced' | 'synced' | 'error'; paypal_last_synced_at: string | null; active: boolean;
}

interface ContactRequest {
  id: string; name: string | null; email: string; category: string; subject: string; message: string;
  status: 'new' | 'in_progress' | 'answered' | 'closed'; response_text: string | null; created_at: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ enabled, onToggle, onClose }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [crmMetrics, setCrmMetrics] = useState({ users: 0, confirmed: 0, activeSubscriptions: 0, signedIn: 0 });
  const [crmSearch, setCrmSearch] = useState('');
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmMessage, setCrmMessage] = useState<string | null>(null);
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [productSaving, setProductSaving] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', currency: 'GBP', billingInterval: 'month', paypalPlanId: '', description: '' });
  const [customer, setCustomer] = useState<any | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [entitlementProduct, setEntitlementProduct] = useState('');
  const [payment, setPayment] = useState({ amount: '', currency: 'GBP', transactionId: '', description: '' });
  const [staffRole, setStaffRole] = useState<'staff' | 'partner_admin' | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<any[]>([]);
  const [staffMessage, setStaffMessage] = useState<string | null>(null);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState<string | null>(null);
  const [manualDiscount, setManualDiscount] = useState({ percent: '', cycles: '' });
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'user', sendInvite: true });
  const [addingUser, setAddingUser] = useState(false);
  const [createdUserPassword, setCreatedUserPassword] = useState<string | null>(null);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [contactReplies, setContactReplies] = useState<Record<string, string>>({});
  const [contactMessage, setContactMessage] = useState<string | null>(null);

  // Direct password reset state
  const [directEmail, setDirectEmail] = useState('');
  const [directResetting, setDirectResetting] = useState(false);
  const [directResult, setDirectResult] = useState<{ email: string; tempPassword?: string; recoveryLink?: string } | null>(null);

  const getAuthHeaders = async () => {
    const supabase = getSupabaseClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session?.access_token) throw new Error('Please sign in before managing password resets.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`
    };
  };

  const parseJsonResponse = async (response: Response) => {
    const text = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`Server response error (${response.status}): ${text.slice(0, 120)}`);
      }
      throw new Error('Received non-JSON response from server.');
    }
    if (!response.ok) {
      throw new Error(payload.error || payload.message || `Server error (${response.status})`);
    }
    return payload;
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    setRequestMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/password-reset-requests', { headers });
      const payload = await parseJsonResponse(response);
      setRequests(payload);
    } catch (error: any) {
      setRequestMessage(error.message || 'Unable to load password reset requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadCrm = async () => {
    setCrmLoading(true);
    setCrmMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/crm/users', { headers });
      const payload = await parseJsonResponse(response);
      setCrmUsers(payload.users ?? []);
      setCrmMetrics(payload.metrics ?? { users: 0, confirmed: 0, activeSubscriptions: 0, signedIn: 0 });
    } catch (error: any) {
      setCrmMessage(error.message || 'Unable to load customers.');
    } finally {
      setCrmLoading(false);
    }
  };

  const loadContactRequests = async () => {
    try {
      const response = await fetch('/api/v1/admin/contact-requests', { headers: await getAuthHeaders() });
      const payload = await parseJsonResponse(response);
      setContactRequests(payload);
      setContactReplies(Object.fromEntries(payload.map((request: ContactRequest) => [request.id, request.response_text || ''])));
    } catch (error: any) { setContactMessage(error.message || 'Unable to load support requests.'); }
  };

  const updateContactRequest = async (request: ContactRequest, status: ContactRequest['status']) => {
    try {
      const responseText = contactReplies[request.id] || '';
      const response = await fetch(`/api/v1/admin/contact-requests/${request.id}`, { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ status, responseText }) });
      const updated = await parseJsonResponse(response);
      setContactRequests(current => current.map(item => item.id === updated.id ? updated : item));
      setContactMessage(`Support request marked ${status.replace('_', ' ')}.`);
    } catch (error: any) { setContactMessage(error.message || 'Unable to update support request.'); }
  };

  const openEmailReply = (request: ContactRequest) => {
    const body = contactReplies[request.id] || '';
    window.location.href = `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(`Re: ${request.subject}`)}&body=${encodeURIComponent(body)}`;
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/v1/admin/crm/products', { headers: await getAuthHeaders() });
      setProducts(await parseJsonResponse(response));
    } catch (error: any) {
      setProductMessage(error.message || 'Unable to load products. Apply the CRM database migration first.');
    }
  };

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setProductSaving(true);
    setProductMessage(null);
    try {
      const price = Number(newProduct.price);
      if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid product price.');
      const response = await fetch('/api/v1/admin/crm/products', {
        method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          priceMinor: Math.round(price * 100),
          currency: newProduct.currency,
          billingInterval: newProduct.billingInterval,
          paypalPlanId: newProduct.paypalPlanId
        })
      });
      const product = await parseJsonResponse(response);
      setProducts((current) => [product, ...current]);
      setNewProduct({ name: '', price: '', currency: 'GBP', billingInterval: 'month', paypalPlanId: '', description: '' });
      setProductMessage('Product created.');
    } catch (error: any) {
      setProductMessage(error.message || 'Unable to create product.');
    } finally {
      setProductSaving(false);
    }
  };

  const toggleProduct = async (product: CrmProduct) => {
    setProductMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/crm/products/${product.id}`, {
        method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ active: !product.active })
      });
      const updated = await parseJsonResponse(response);
      setProducts((current) => current.map((item) => item.id === product.id ? updated : item));
    } catch (error: any) {
      setProductMessage(error.message || 'Unable to update product.');
    }
  };

  const openCustomer = async (userId: string) => {
    setCustomerLoading(true); setCustomerMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/crm/users/${userId}`, { headers: await getAuthHeaders() });
      setCustomer(await parseJsonResponse(response));
    } catch (error: any) { setCrmMessage(error.message || 'Unable to load customer.'); }
    finally { setCustomerLoading(false); }
  };

  const customerAction = async (path: string, body: any, success: string) => {
    if (!customer?.identity?.id) return;
    setCustomerMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/crm/users/${customer.identity.id}/${path}`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) });
      await parseJsonResponse(response);
      await openCustomer(customer.identity.id);
      setCustomerMessage(success);
    } catch (error: any) { setCustomerMessage(error.message || 'CRM action failed.'); }
  };

  const loadStaff = async () => {
    try {
      const response = await fetch('/api/v1/admin/staff', { headers: await getAuthHeaders() });
      setStaffAccounts(await parseJsonResponse(response));
    } catch (error: any) { setStaffMessage(error.message || 'Unable to load staff accounts.'); }
  };

  const changeRole = async (userId: string, role: 'user' | 'staff' | 'partner_admin') => {
    setStaffMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/role`, { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ role }) });
      await parseJsonResponse(response);
      await Promise.all([loadStaff(), loadCrm()]);
      if (customer?.identity?.id === userId) await openCustomer(userId);
      setStaffMessage('Account role updated.');
    } catch (error: any) { setStaffMessage(error.message || 'Unable to change account role.'); }
  };

  const createPayPalSubscription = async () => {
    if (!customer?.identity?.id || !entitlementProduct) return;
    setCustomerMessage(null); setPaypalApprovalUrl(null);
    try {
      const response = await fetch(`/api/v1/admin/crm/users/${customer.identity.id}/paypal-subscriptions`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ productId: entitlementProduct, ...(staffRole === 'partner_admin' && manualDiscount.percent && manualDiscount.cycles ? { discountPercent: Number(manualDiscount.percent), discountCycles: Number(manualDiscount.cycles) } : {}) }) });
      const data = await parseJsonResponse(response);
      setPaypalApprovalUrl(data.approvalUrl);
      await openCustomer(customer.identity.id);
      setCustomerMessage('PayPal subscription created. Send the approval link to the customer.');
    } catch (error: any) { setCustomerMessage(error.message || 'Unable to create PayPal subscription.'); }
  };

  const addUser = async (event: React.FormEvent) => {
    event.preventDefault(); setAddingUser(true); setCrmMessage(null);
    try {
      const response = await fetch('/api/v1/admin/crm/users', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(newUser) });
      const data = await parseJsonResponse(response);
      setNewUser({ name: '', email: '', role: 'user', sendInvite: true });
      setCreatedUserPassword(data.temporaryPassword ?? null);
      await Promise.all([loadCrm(), staffRole === 'partner_admin' ? loadStaff() : Promise.resolve()]);
      setCrmMessage(data.invited ? `Invitation sent to ${data.email}.` : `Account created for ${data.email}. Copy the temporary password now.`);
    } catch (error: any) { setCrmMessage(error.message || 'Unable to invite user.'); }
    finally { setAddingUser(false); }
  };

  const resetPassword = async (request: any) => {
    setResettingId(request.id);
    setRequestMessage(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/admin/password-reset-requests/${request.id}/reset`, {
        method: 'POST',
        headers
      });
      const payload = await parseJsonResponse(response);
      setRequests((current) => current.map((item) => item.id === request.id ? payload.request : item));
      setRequestMessage(`Temporary password created for ${request.email}: ${payload.tempPassword}`);
    } catch (error: any) {
      setRequestMessage(error.message || 'Unable to issue a temporary password.');
    } finally {
      setResettingId(null);
    }
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmail.trim()) return;
    setDirectResetting(true);
    setRequestMessage(null);
    setDirectResult(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/direct-password-reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: directEmail.trim() })
      });
      const payload = await parseJsonResponse(response);
      setDirectResult({
        email: payload.email,
        tempPassword: payload.tempPassword,
        recoveryLink: payload.recoveryLink
      });
      setDirectEmail('');
    } catch (error: any) {
      setRequestMessage(error.message || 'Unable to reset password.');
    } finally {
      setDirectResetting(false);
    }
  };

  useEffect(() => {
    getAuthHeaders().then((headers) => fetch('/api/v1/admin/me', { headers })).then(parseJsonResponse).then((data) => setStaffRole(data.role)).catch((error) => setCrmMessage(error.message));
    void loadRequests();
    void loadCrm();
    void loadProducts();
    void loadContactRequests();
  }, []);

  useEffect(() => { if (staffRole === 'partner_admin') void loadStaff(); }, [staffRole]);

  const visibleCrmUsers = crmUsers.filter((user) => {
    const query = crmSearch.trim().toLowerCase();
    return !query || user.email.toLowerCase().includes(query) || user.name.toLowerCase().includes(query);
  });

  const updateLaunch = async (value: boolean) => {
    try {
      const response = await fetch('/api/v1/admin/site-settings/launch', { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ enabled: value }) });
      const data = await parseJsonResponse(response);
      onToggle(data.enabled);
    } catch (error: any) { setCrmMessage(error.message || 'Unable to update launch status.'); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
              <ShieldCheck className="h-4 w-4" />
              {staffRole === 'partner_admin' ? 'Admin Controls' : 'Staff CRM'}
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">Q Customer Operations</h2>
            <p className="mt-1 text-sm text-slate-300">Manage customers, subscriptions, payments, tasks, and support activity.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {staffRole === 'partner_admin' && <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Enable new launch landing page</p>
              <p className="mt-1 text-sm text-slate-400">When on, visitors see the launch-style landing page. When off, the waitlist landing page is shown.</p>
            </div>
            <button
              type="button"
              onClick={() => void updateLaunch(!enabled)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${enabled ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>}

        {staffRole === 'partner_admin' && <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Current status: {enabled ? 'New launch landing page enabled' : 'Waitlist landing page enabled'}
        </div>}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-white"><MessageSquareText className="h-4 w-4 text-sky-300" /><p className="text-sm font-semibold">Support inbox</p></div><p className="mt-1 text-sm text-slate-400">Questions sent from the login screen. Draft a response, open it in your staff email client, then update the CRM status.</p></div><button type="button" onClick={() => void loadContactRequests()} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/10" title="Refresh support inbox"><RefreshCw className="h-4 w-4" /></button></div>
          {contactMessage && <p className="mt-3 rounded-xl bg-sky-500/10 p-3 text-xs text-sky-100">{contactMessage}</p>}
          <div className="mt-4 space-y-3">
            {contactRequests.length === 0 ? <p className="text-xs text-slate-400">No contact requests yet.</p> : contactRequests.map(request => <article key={request.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-sky-300">{request.category}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.status === 'new' ? 'bg-amber-500/15 text-amber-200' : request.status === 'answered' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{request.status.replace('_', ' ')}</span></div><h3 className="mt-1 font-bold text-white">{request.subject}</h3><p className="mt-1 text-xs text-slate-400">{request.name || 'No name'} · {request.email} · {new Date(request.created_at).toLocaleString()}</p></div><button type="button" onClick={() => navigator.clipboard.writeText(request.email)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/10"><Copy className="h-3 w-3" />Email</button></div>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-200">{request.message}</p>
              <textarea value={contactReplies[request.id] || ''} onChange={event => setContactReplies({ ...contactReplies, [request.id]: event.target.value })} rows={4} placeholder="Draft the reply that will be sent by email…" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-xs text-white placeholder:text-slate-500" />
              <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => openEmailReply(request)} disabled={!contactReplies[request.id]?.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Mail className="h-3.5 w-3.5" />Open email reply</button><button type="button" onClick={() => void updateContactRequest(request, 'in_progress')} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10">In progress</button><button type="button" onClick={() => void updateContactRequest(request, 'answered')} disabled={!contactReplies[request.id]?.trim()} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Mark answered</button><button type="button" onClick={() => void updateContactRequest(request, 'closed')} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white">Close</button></div>
            </article>)}
          </div>
        </section>

        {staffRole === 'partner_admin' && <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-white"><UserCog className="h-4 w-4 text-purple-300"/><p className="text-sm font-semibold">Staff management</p></div><p className="mt-1 text-sm text-slate-400">Promote, demote, and review authorised CRM accounts.</p></div><button onClick={() => void loadStaff()} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/10"><RefreshCw className="h-4 w-4"/></button></div>
          {staffMessage && <p className="mt-3 rounded-xl bg-purple-500/10 p-3 text-xs text-purple-100">{staffMessage}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2">{staffAccounts.map((account) => <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{account.preferred_name || account.email}</p><p className="truncate text-xs text-slate-500">{account.email}</p></div><select value={account.role} onChange={(event) => void changeRole(account.id, event.target.value as any)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"><option value="staff">Staff</option><option value="partner_admin">Admin</option><option value="user">User</option></select></div>)}</div>
          <p className="mt-3 text-[11px] text-slate-500">To promote a regular customer, open their customer record and change their account role.</p>
        </section>}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Q Customer CRM</p>
              <p className="mt-1 text-sm text-slate-400">Users, signups, logins, and PayPal subscription records in one place.</p>
            </div>
            <button type="button" onClick={() => void loadCrm()} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
              <RefreshCw className={`h-3.5 w-3.5 ${crmLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <form onSubmit={addUser} className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:grid-cols-5">
            <div className="flex items-center gap-2 text-xs font-bold text-white md:col-span-5"><UserPlus className="h-4 w-4 text-purple-300"/>Add user</div>
            <input value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="Name" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-2"/>
            <input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="Email address" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-2"/>
            {staffRole === 'partner_admin' ? <select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"><option value="user">User</option><option value="staff">Staff</option><option value="partner_admin">Admin</option></select> : <input readOnly value="User" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-400"/>}
            {staffRole === 'partner_admin' && <label className="flex items-center gap-2 text-xs text-slate-300 md:col-span-4"><input type="checkbox" checked={!newUser.sendInvite} onChange={(event) => setNewUser({ ...newUser, sendInvite: !event.target.checked })} className="accent-purple-600"/>Create directly with a temporary password instead of sending an invitation</label>}
            <button disabled={addingUser} className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 md:col-start-5">{addingUser ? 'Creating…' : newUser.sendInvite ? 'Send invitation' : 'Create account'}</button>
            {createdUserPassword && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100 md:col-span-5"><span>Temporary password: <b className="font-mono">{createdUserPassword}</b></span><button type="button" onClick={() => navigator.clipboard.writeText(createdUserPassword)} className="font-bold">Copy</button></div>}
          </form>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Users', value: crmMetrics.users, icon: Users },
              { label: 'Verified', value: crmMetrics.confirmed, icon: UserCheck },
              { label: 'Signed in', value: crmMetrics.signedIn, icon: LogIn },
              { label: 'Active plans', value: crmMetrics.activeSubscriptions, icon: CreditCard }
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <Icon className="h-4 w-4 text-purple-300" />
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input value={crmSearch} onChange={(event) => setCrmSearch(event.target.value)} placeholder="Search by name or email" className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-2 pl-10 pr-3 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none" />
          </div>

          {crmMessage && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{crmMessage}</div>}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="p-3">Customer</th><th className="p-3">Signup</th><th className="p-3">Last login</th><th className="p-3">Account</th><th className="p-3">Subscription</th><th className="p-3">Renews / ends</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {crmLoading && crmUsers.length === 0 ? (
                  <tr><td colSpan={6} className="p-5 text-center text-slate-400">Loading customers…</td></tr>
                ) : visibleCrmUsers.length === 0 ? (
                  <tr><td colSpan={6} className="p-5 text-center text-slate-400">No matching customers.</td></tr>
                ) : visibleCrmUsers.map((user) => (
                  <tr key={user.id} onClick={() => void openCustomer(user.id)} className="cursor-pointer bg-slate-950/30 text-slate-300 transition hover:bg-purple-500/10">
                    <td className="p-3"><p className="font-semibold text-white">{user.name}</p><p className="mt-0.5 text-slate-500">{user.email}</p></td>
                    <td className="p-3">{new Date(user.signupAt).toLocaleDateString()}</td>
                    <td className="p-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                    <td className="p-3"><span className="rounded-full bg-purple-500/10 px-2 py-1 text-purple-200">{user.role}</span><p className="mt-2 text-[10px] text-slate-500">{user.emailConfirmedAt ? 'Email verified' : 'Awaiting verification'}</p></td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 ${user.subscription?.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-slate-700/60 text-slate-300'}`}>{user.subscription?.status ?? 'Not subscribed'}</span></td>
                    <td className="p-3">{user.subscription?.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {staffRole === 'partner_admin' && <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 text-white"><Package className="h-4 w-4 text-purple-300" /><p className="text-sm font-semibold">Product management</p></div>
          <p className="mt-1 text-sm text-slate-400">Manage Q products and connect recurring products to their PayPal plan IDs.</p>

          <form onSubmit={createProduct} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 md:grid-cols-6">
            <input required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Product name" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-2" />
            <input required type="number" min="0" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Price" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
            <select value={newProduct.currency} onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"><option>GBP</option><option>USD</option><option>EUR</option></select>
            <select value={newProduct.billingInterval} onChange={(e) => setNewProduct({ ...newProduct, billingInterval: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"><option value="one_time">One time</option><option value="month">Monthly</option><option value="year">Yearly</option></select>
            <button disabled={productSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />{productSaving ? 'Saving…' : 'Add product'}</button>
            <input value={newProduct.paypalPlanId} onChange={(e) => setNewProduct({ ...newProduct, paypalPlanId: e.target.value })} placeholder="PayPal plan ID (optional)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-2" />
            <input value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Description (optional)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white md:col-span-4" />
          </form>
          {productMessage && <p className="mt-3 text-xs text-amber-200">{productMessage}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.length === 0 ? <p className="text-xs text-slate-400">No products created yet.</p> : products.map((product) => (
              <div key={product.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{product.name}</p><p className="mt-1 text-xs text-slate-400">{product.description || 'No description'}</p></div><button type="button" onClick={() => void toggleProduct(product)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${product.active ? 'bg-emerald-500/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{product.active ? 'ACTIVE' : 'INACTIVE'}</button></div>
                <p className="mt-3 text-xl font-black text-white">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: product.currency }).format(product.price_minor / 100)} <span className="text-xs font-medium text-slate-400">/{product.billing_interval}</span></p>
                <p className="mt-2 truncate text-[10px] text-slate-500">PayPal: {product.paypal_plan_id || 'Not linked'} · Sync: {product.paypal_sync_status}</p>
              </div>
            ))}
          </div>
        </section>}

        {staffRole === 'partner_admin' && <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Direct password reset</p>
              <p className="mt-1 text-sm text-slate-400">Enter any user's email to instantly issue a temporary password and reset link.</p>
            </div>
          </div>

          <form onSubmit={handleDirectPasswordReset} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={directResetting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {directResetting ? 'Resetting…' : 'Issue temp password'}
            </button>
          </form>

          {directResult && (
            <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 space-y-1.5">
              <p className="font-semibold text-emerald-100">Password reset for {directResult.email}:</p>
              {directResult.tempPassword && (
                <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-emerald-400/20">
                  <span className="font-mono text-emerald-300">Temp Password: {directResult.tempPassword}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(directResult.tempPassword!)}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              )}
              {directResult.recoveryLink && (
                <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-emerald-400/20">
                  <span className="truncate font-mono text-[11px] text-slate-300">Link: {directResult.recoveryLink}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(directResult.recoveryLink!)}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:underline shrink-0"
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>}

        {staffRole === 'partner_admin' && <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Password reset requests</p>
              <p className="mt-1 text-sm text-slate-400">Review contact requests from the login page and issue a temporary password.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Refresh requests"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {requestMessage && (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              {requestMessage}
            </div>
          )}

          {loadingRequests ? (
            <div className="mt-4 text-sm text-slate-400">Loading requests…</div>
          ) : requests.length === 0 ? (
            <div className="mt-4 text-sm text-slate-400">No password reset requests submitted yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{request.email}</p>
                      <p className="mt-1 text-xs text-slate-400">{request.message || 'No details supplied.'}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{request.status}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void resetPassword(request)}
                      disabled={resettingId === request.id}
                      className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-60 shrink-0"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {resettingId === request.id ? 'Resetting…' : request.status === 'reset' ? 'Reset again' : 'Reset password'}
                    </button>
                  </div>
                  {request.tempPassword && (
                    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">Temp password: {request.tempPassword}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(request.tempPassword)}
                          className="font-bold text-emerald-400 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>}

        {(customer || customerLoading) && (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-sm">
            <div className="mx-auto my-4 max-w-6xl rounded-3xl border border-white/15 bg-slate-950 p-6 shadow-2xl">
              {customerLoading && !customer ? <p className="text-slate-300">Loading customer record…</p> : customer && <>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-bold uppercase tracking-widest text-purple-300">360° customer record</p><h2 className="mt-2 text-2xl font-black text-white">{customer.profile?.preferred_name || customer.identity.email}</h2><p className="text-sm text-slate-400">{customer.identity.email} · {customer.identity.id}</p></div>
                  <button onClick={() => setCustomer(null)} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                {customerMessage && <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-500/10 p-3 text-xs text-purple-100">{customerMessage}</div>}

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Personal details</h3><dl className="mt-3 space-y-2 text-xs text-slate-300">
                    <div><dt className="text-slate-500">Email</dt><dd>{customer.identity.email}</dd></div><div><dt className="text-slate-500">Phone</dt><dd>{customer.profile?.phone || customer.identity.phone || 'Not supplied'}</dd></div><div><dt className="text-slate-500">Pronouns</dt><dd>{customer.profile?.pronouns || 'Not supplied'}</dd></div><div><dt className="text-slate-500">Region</dt><dd>{customer.profile?.location_region || 'Not supplied'}</dd></div><div><dt className="text-slate-500">Company</dt><dd>{customer.profile?.company || 'Not supplied'}</dd></div><div><dt className="text-slate-500">CRM status</dt><dd>{customer.profile?.crm_status || 'customer'}</dd></div>
                  </dl></section>
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Account</h3><dl className="mt-3 space-y-2 text-xs text-slate-300"><div><dt className="text-slate-500">Created</dt><dd>{new Date(customer.identity.signupAt).toLocaleString()}</dd></div><div><dt className="text-slate-500">Last login</dt><dd>{customer.identity.lastLoginAt ? new Date(customer.identity.lastLoginAt).toLocaleString() : 'Never'}</dd></div><div><dt className="text-slate-500">Email</dt><dd>{customer.identity.emailConfirmedAt ? 'Verified' : 'Unverified'}</dd></div><div><dt className="text-slate-500">Role</dt><dd>{customer.profile?.role}</dd></div></dl>{staffRole === 'partner_admin' && <div className="mt-4"><label className="text-[10px] uppercase tracking-wider text-slate-500">Change access role</label><select value={customer.profile?.role || 'user'} onChange={(event) => void changeRole(customer.identity.id, event.target.value as any)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="user">User</option><option value="staff">Staff</option><option value="partner_admin">Admin</option></select></div>}</section>
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">PayPal subscription</h3>{customer.subscription ? <dl className="mt-3 space-y-2 text-xs text-slate-300"><div><dt className="text-slate-500">Status</dt><dd>{customer.subscription.status}</dd></div><div><dt className="text-slate-500">Plan</dt><dd>{customer.subscription.paypal_plan_id}</dd></div><div><dt className="text-slate-500">Subscription ID</dt><dd>{customer.subscription.paypal_subscription_id}</dd></div><div><dt className="text-slate-500">Next billing</dt><dd>{customer.subscription.current_period_end ? new Date(customer.subscription.current_period_end).toLocaleDateString() : 'Unknown'}</dd></div></dl> : <p className="mt-3 text-xs text-slate-400">No PayPal subscription.</p>}</section>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Assign access or subscription</h3><select value={entitlementProduct} onChange={(e) => { setEntitlementProduct(e.target.value); setPaypalApprovalUrl(null); }} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="">Choose product</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{staffRole === 'partner_admin' && <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Optional admin discount</p><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="1" max="100" value={manualDiscount.percent} onChange={e=>setManualDiscount({...manualDiscount,percent:e.target.value})} placeholder="Discount %" className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white"/><input type="number" min="1" max="999" value={manualDiscount.cycles} onChange={e=>setManualDiscount({...manualDiscount,cycles:e.target.value})} placeholder="Billing cycles" className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white"/></div><p className="mt-2 text-[10px] text-slate-400">Leave both blank for standard pricing. The customer must approve the schedule in PayPal.</p></div>}<div className="mt-2 flex gap-2"><button onClick={() => void customerAction('entitlements',{productId: entitlementProduct},'Access assigned.')} disabled={!entitlementProduct} className="flex-1 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Assign manual access</button><button onClick={() => void createPayPalSubscription()} disabled={!entitlementProduct} className="flex-1 rounded-xl bg-[#0070ba] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Create PayPal subscription</button></div>{paypalApprovalUrl && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-100"><p className="font-bold">Customer approval required</p><div className="mt-2 flex gap-2"><input readOnly value={paypalApprovalUrl} className="min-w-0 flex-1 rounded-lg bg-slate-950 px-2 py-1 text-[10px]"/><button onClick={() => navigator.clipboard.writeText(paypalApprovalUrl)} className="font-bold">Copy</button></div></div>}<div className="mt-3 space-y-2">{customer.entitlements.map((item:any)=><div key={item.id} className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300"><b className="text-white">{item.crm_products?.name}</b> · {item.status} · {item.source}{item.ends_at ? ` · ends ${new Date(item.ends_at).toLocaleDateString()}` : ''}</div>)}</div></section>
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">Take a card payment</h3><a href="https://www.paypal.com/mep/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-[#0070ba] px-3 py-2 text-xs font-bold text-white">Open PayPal Virtual Terminal <ExternalLink className="h-3 w-3" /></a></div><p className="mt-2 text-xs text-slate-400">Enter card details only in PayPal. After approval, record the PayPal transaction below.</p><div className="mt-3 grid grid-cols-2 gap-2"><input value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} type="number" step="0.01" placeholder="Amount" className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"/><select value={payment.currency} onChange={e=>setPayment({...payment,currency:e.target.value})} className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"><option>GBP</option><option>USD</option><option>EUR</option></select><input value={payment.transactionId} onChange={e=>setPayment({...payment,transactionId:e.target.value})} placeholder="PayPal transaction ID" className="col-span-2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"/><input value={payment.description} onChange={e=>setPayment({...payment,description:e.target.value})} placeholder="Description" className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"/><button onClick={() => void customerAction('payments',{amountMinor:Math.round(Number(payment.amount)*100),currency:payment.currency,providerTransactionId:payment.transactionId,description:payment.description},'Payment recorded.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Record payment</button></div></section>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Notes</h3><textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} placeholder="Add a non-sensitive CRM note" className="mt-3 w-full rounded-xl bg-slate-900 p-3 text-xs text-white"/><button onClick={() => { void customerAction('notes',{body:noteBody},'Note added.'); setNoteBody(''); }} className="mt-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white">Add note</button><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{customer.notes.map((n:any)=><div key={n.id} className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">{n.body}<p className="mt-1 text-[10px] text-slate-500">{new Date(n.created_at).toLocaleString()}</p></div>)}</div></section>
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Tasks</h3><div className="mt-3 flex gap-2"><input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Follow-up task" className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"/><button onClick={() => { void customerAction('tasks',{title:taskTitle},'Task created.'); setTaskTitle(''); }} className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white">Add</button></div><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{customer.tasks.map((t:any)=><div key={t.id} className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300"><ClipboardList className="mr-1 inline h-3 w-3"/>{t.title} · {t.status}</div>)}</div></section>
                  {staffRole === 'partner_admin' && <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Audit and activity timeline</h3><div className="mt-3 max-h-72 space-y-3 overflow-y-auto">{customer.activities.map((a:any)=><div key={a.id} className="border-l border-purple-500/40 pl-3 text-xs text-slate-300"><b className="text-white">{a.summary}</b><p className="text-[10px] text-slate-500">{new Date(a.created_at).toLocaleString()}</p></div>)}</div></section>}
                </div>

                <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Referral credit ledger</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="p-2">Date</th><th>Type</th><th>Status</th><th>Note</th><th className="text-right">Amount</th></tr></thead><tbody>{customer.referralCredits?.map((c:any)=><tr key={c.id} className="border-t border-white/10 text-slate-300"><td className="p-2">{new Date(c.created_at).toLocaleDateString()}</td><td>{c.kind}</td><td>{c.status}</td><td>{c.note || '—'}</td><td className="text-right">{new Intl.NumberFormat('en-GB',{style:'currency',currency:c.currency}).format(c.amount_minor/100)}</td></tr>)}</tbody></table></div></section>

                <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">Payment history</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="p-2">Date</th><th>Reference</th><th>Description</th><th>Status</th><th className="text-right">Amount</th></tr></thead><tbody>{customer.payments.map((p:any)=><tr key={p.id} className="border-t border-white/10 text-slate-300"><td className="p-2">{new Date(p.occurred_at).toLocaleDateString()}</td><td>{p.provider_transaction_id}</td><td>{p.description || p.payment_type}</td><td>{p.status}</td><td className="text-right">{new Intl.NumberFormat('en-GB',{style:'currency',currency:p.currency}).format(p.amount_minor/100)}</td></tr>)}</tbody></table></div></section>
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
