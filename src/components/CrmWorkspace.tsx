import { CrmEmailSyncProvider } from '../contexts/CrmEmailSyncContext';
import React, { useEffect, useState } from 'react';
import { Users, Mail, MessageCircle, Radio, FileText, BookOpen, Package, Settings, Link as LinkIcon, UserCog, ArrowLeft, LogOut, Newspaper, KeyRound, Eye, ScrollText, Archive, ClipboardList, PenLine, Activity, Trophy } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';
import { type CrmEmailSignature } from '../services/crmEmailSignature';
import CrmEmailSignatureSetup from './CrmEmailSignatureSetup';

export const crmViews: Record<string, { title: string; description: string; admin?: boolean }> = {
  customers: { title: 'Customers', description: 'Customer records, account access and communication history.' },
  review: { title: 'Content review', description: 'Review customer contributions before publication.' },
  guides: { title: 'Life Guides', description: 'Manage the shared guidance catalogue.' },
  access: { title: 'Account support', description: 'Review password requests and help customers regain access.' },
  publishing: { title: 'Publishing', description: 'News, updates, help videos and authorised publishers.', admin: true },
  competition: { title: 'Community competition', description: 'Preview monthly finalists, award winners and deliver the newsletter.', admin: true },
  products: { title: 'Products', description: 'Manage products and subscription plans.', admin: true },
  team: { title: 'Team access', description: 'Manage staff and administrator access.', admin: true },
  'customer-archive': { title: 'Customer archive', description: 'Download customer records before optionally deleting their Q accounts.', admin: true },
  'audit-log': { title: 'Audit log', description: 'Review activity and security events across Q.', admin: true },
  integrations: { title: 'Integrations', description: 'Manage connected services and event notifications.', admin: true },
  settings: { title: 'Site settings', description: 'Manage public availability and preview Q.', admin: true },
  'vercel-logs': { title: 'Vercel logs', description: 'Live runtime logs from the Q production project.', admin: true },
  'it-hub': { title: 'IT Hub', description: 'Service health, incident management and IT Hub event history.', admin: true },
};

export default function CrmWorkspace({ children, view = 'customers', onSignOut, onBack, onPreview }: { children: React.ReactNode; view?: string; onSignOut: () => Promise<void>; onBack?: () => void; onPreview?: () => Promise<void> }) {
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [signature, setSignature] = useState<CrmEmailSignature | null>(null);
  const [signatureDefaultName, setSignatureDefaultName] = useState('');
  const [signatureLoaded, setSignatureLoaded] = useState(false);
  const [signatureEditorOpen, setSignatureEditorOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const session = (await getSupabaseClient()?.auth.getSession())?.data.session;
      if (!session) throw Error('Sign in to open the CRM.');
      const response = await fetch('/api/v1/admin/me', { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to check CRM access.');
      if (!controller.signal.aborted) {
        setRole(data.role);
        setPermissions(data.permissions || []);
        setSignature(data.emailSignature || null);
        setSignatureDefaultName(data.signatureDefaultName || '');
        setSignatureLoaded(true);
      }
    })().catch(loadError => { if (!controller.signal.aborted) { setError(loadError instanceof Error ? loadError.message : 'Unable to check CRM access.'); setSignatureLoaded(true); } });
    return () => controller.abort();
  }, []);

  const admin = role === 'partner_admin';
  const allowed = role === 'staff' || admin;
  const info = crmViews[view];
  const links = [['customers', 'Customers', Users, '/crm'], ['communications', 'Communications', Mail, '/crm/comms'], ['chat', 'Team chat', MessageCircle, '/crm/chat'], ['online', 'Online users', Radio, '/crm/online'], ['review', 'Content review', FileText, '/crm?view=review'], ['guides', 'Life Guides', BookOpen, '/crm?view=guides'], ['access', 'Account support', KeyRound, '/crm?view=access']] as const;
  const adminLinks = [['publishing', 'Publishing', Newspaper], ['competition', 'Competition', Trophy], ['products', 'Products', Package], ['team', 'Team access', UserCog], ['customer-archive', 'Customer archive', Archive], ['audit-log', 'Audit log', ClipboardList], ['integrations', 'Integrations', LinkIcon], ['it-hub', 'IT Hub', Activity], ['vercel-logs', 'Vercel logs', ScrollText], ['settings', 'Site settings', Settings]] as const;
  const nav = (id: string, label: string, Icon: typeof Users, href: string) => <a key={id} href={href} aria-current={view === id ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 py-3 text-sm ${view === id ? 'border-violet-500 bg-violet-500/15 text-white' : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'}`}><Icon className="h-5 w-5 shrink-0" />{label}</a>;

  if (!signatureLoaded || !allowed) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><p role={error ? 'alert' : 'status'}>{error || 'Checking workspace access…'}</p></main>;
  if (!signature) return <main className="min-h-screen bg-slate-950 p-4 py-8 sm:p-8"><div className="mx-auto mb-4 flex max-w-6xl justify-end"><button disabled={signingOut} onClick={() => { setSigningOut(true); void onSignOut().catch(() => { setError('Could not sign out. Please try again.'); setSigningOut(false); }); }} className="min-h-11 rounded-lg px-4 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"><LogOut className="mr-2 inline h-4 w-4" />{signingOut ? 'Signing out…' : 'Log out'}</button></div>{error && <p role="alert" className="mx-auto mb-4 max-w-6xl rounded-lg bg-rose-500/10 p-3 text-rose-200">{error}</p>}<CrmEmailSignatureSetup required defaultName={signatureDefaultName} onSaved={setSignature} /></main>;

  return <div className="crm-workspace min-h-screen bg-slate-950 text-slate-100 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="border-b border-slate-800 bg-slate-900/70 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
      <a href="/crm" className="mb-6 flex items-center gap-3 text-sm font-semibold"><span className="text-4xl font-black text-violet-500">Q</span><span>Customer<br />Operations</span></a>
      <nav aria-label="CRM workspace" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:block lg:space-y-1">{links.map(([id, label, Icon, href]) => nav(id, label, Icon, href))}</nav>
      {admin && <nav aria-label="Administration" className="mt-6 grid grid-cols-2 gap-1 border-t border-slate-700 pt-4 sm:grid-cols-3 lg:block lg:space-y-1"><p className="col-span-full mb-2 px-3 text-xs text-slate-400">Administration</p>{adminLinks.map(([id, label, Icon]) => nav(id, label, Icon, '/crm?view=' + id))}</nav>}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-800 pt-4 lg:mt-auto lg:flex-col">
        <button type="button" onClick={() => setSignatureEditorOpen(true)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"><PenLine className="h-5 w-5" />Email signature</button>
        {onPreview && <button type="button" disabled={previewLoading} title="Sign in again with your CRM account to preview. Refreshing or signing out ends preview." onClick={async () => { setPreviewLoading(true); setError(''); try { await onPreview(); } catch (previewError) { setError(previewError instanceof Error ? previewError.message : 'Unable to preview the site.'); } finally { setPreviewLoading(false); } }} className="flex min-h-11 items-center gap-3 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"><Eye className="h-5 w-5 shrink-0" />{previewLoading ? 'Opening preview…' : 'Preview Site'}</button>}
        <a href="/training" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"><BookOpen className="h-5 w-5" />Training site</a>
        <button onClick={() => onBack ? onBack() : window.location.assign('/app')} className="flex min-h-11 items-center gap-3 px-3 text-sm text-slate-300"><ArrowLeft className="h-5 w-5" />Back to Q</button>
        <button disabled={signingOut} onClick={() => { setSigningOut(true); void onSignOut().catch(() => { setError('Could not sign out. Please try again.'); setSigningOut(false); }); }} className="flex min-h-11 items-center gap-3 px-3 text-sm text-slate-300 disabled:opacity-50"><LogOut className="h-5 w-5" />{signingOut ? 'Signing out…' : 'Log out'}</button>
      </div>
    </aside>
    <main className="min-w-0 p-4 sm:p-6 xl:p-8">
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-500/10 p-3 text-rose-200">{error}</p>}
      {info?.admin && !admin ? <p role="alert">Administrator access is required for this section.</p> : <>
        {info && <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">{info.title}</h1><p className="mt-2 text-sm text-slate-400">{info.description}</p></div>{view === 'customers' && <button onClick={() => { const form = document.getElementById('crm-add-customer'); if (form instanceof HTMLDetailsElement) { form.open = true; form.scrollIntoView({ block: 'center' }); } }} className="min-h-11 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">+ Add customer</button>}</header>}
        <CrmEmailSyncProvider allowed={admin || !permissions.length || permissions.includes('support.write')}>{children}</CrmEmailSyncProvider>
      </>}
    </main>
    {signatureEditorOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-4 py-8 sm:p-8" role="dialog" aria-modal="true" aria-label="Email signature settings"><CrmEmailSignatureSetup initial={signature} defaultName={signatureDefaultName} onSaved={saved => { setSignature(saved); setSignatureEditorOpen(false); }} onCancel={() => setSignatureEditorOpen(false)} /></div>}
  </div>;
}
