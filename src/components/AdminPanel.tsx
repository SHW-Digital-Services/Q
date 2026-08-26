import React, { useEffect, useState } from 'react';
import { Settings, ShieldCheck, RefreshCw, KeyRound, Search, Users, UserCheck, CreditCard, LogIn, Package, Plus } from 'lucide-react';
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
  billing_interval: 'one_time' | 'month' | 'year'; paypal_plan_id: string | null; active: boolean;
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
    void loadRequests();
    void loadCrm();
    void loadProducts();
  }, []);

  const visibleCrmUsers = crmUsers.filter((user) => {
    const query = crmSearch.trim().toLowerCase();
    return !query || user.email.toLowerCase().includes(query) || user.name.toLowerCase().includes(query);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
              <ShieldCheck className="h-4 w-4" />
              Admin Controls
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">Launch experience toggle</h2>
            <p className="mt-1 text-sm text-slate-300">Switch the public landing experience between the waitlist page and the new launch page.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Enable new launch landing page</p>
              <p className="mt-1 text-sm text-slate-400">When on, visitors see the launch-style landing page. When off, the waitlist landing page is shown.</p>
            </div>
            <button
              type="button"
              onClick={() => onToggle(!enabled)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${enabled ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Current status: {enabled ? 'New launch landing page enabled' : 'Waitlist landing page enabled'}
        </div>

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
                  <tr key={user.id} className="bg-slate-950/30 text-slate-300">
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

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
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
                <p className="mt-2 truncate text-[10px] text-slate-500">PayPal: {product.paypal_plan_id || 'Not linked'}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
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
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
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
        </div>
      </div>
    </div>
  );
};
