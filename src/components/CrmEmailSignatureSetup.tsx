import React, { useMemo, useState } from 'react';
import { Copy, LoaderCircle, Save } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';
import {
  crmEmailSignatureLogoUrl,
  crmSignatureWebsite,
  crmSupportEmail,
  normalizeCrmEmailSignature,
  renderCrmEmailSignatureHtml,
  renderCrmEmailSignatureText,
  type CrmEmailSignature,
} from '../services/crmEmailSignature';

type Props = {
  initial?: CrmEmailSignature | null;
  defaultName?: string;
  required?: boolean;
  onSaved: (signature: CrmEmailSignature) => void;
  onCancel?: () => void;
};

const control = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200';

export default function CrmEmailSignatureSetup({ initial, defaultName = '', required = false, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name || defaultName);
  const [title, setTitle] = useState(initial?.title || 'Customer Service Agent');
  const [pronouns, setPronouns] = useState(initial?.pronouns || '');
  const website = crmSignatureWebsite;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const signature = useMemo(() => normalizeCrmEmailSignature({ name, title, pronouns, website }), [name, title, pronouns]);
  const signatureHtml = signature ? renderCrmEmailSignatureHtml(signature) : '';

  async function save() {
    if (!signature || busy) return;
    const client = getSupabaseClient();
    if (!client) { setError('Q sign-in is not configured. Contact an Admin.'); return; }
    setBusy(true); setError('');
    try {
      const { error: updateError } = await client.auth.updateUser({ data: { crm_email_signature: signature } });
      if (updateError) throw updateError;
      onSaved(signature);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your email signature. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copySignature() {
    if (!signature) return;
    const html = renderCrmEmailSignatureHtml(signature);
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([renderCrmEmailSignatureText(signature)], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(renderCrmEmailSignatureText(signature));
      }
      setCopied(true); window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Your browser could not copy the signature. Save it here and it will be added to CRM emails automatically.');
    }
  }

  return <section className="mx-auto grid w-full max-w-6xl gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-xl sm:p-6 lg:grid-cols-12 lg:p-8" aria-labelledby="crm-signature-title">
    <div className="lg:col-span-5">
      <header className="mb-6 flex items-center gap-3">
        <img src={crmEmailSignatureLogoUrl} alt="Q Intelligence" className="h-10 w-10 rounded-xl object-contain" />
        <div><p className="text-sm font-bold text-slate-900">Q Intelligence</p><p className="text-xs font-medium text-cyan-700">Customer Service Agent Signature</p></div>
      </header>
      <h1 id="crm-signature-title" className="text-xl font-semibold">{required ? 'Set up your email signature' : 'Edit your email signature'}</h1>
      <p className="mb-6 mt-1 text-xs leading-5 text-slate-600">{required ? 'Complete this once before using the CRM. Your signature will be included automatically with emails you send.' : 'Update the details used in your CRM email signature.'}</p>

      <div className="space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Agent name<input required maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={`${control} mt-1 normal-case tracking-normal font-normal`} placeholder="Your full name" /></label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Job title<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className={`${control} mt-1 normal-case tracking-normal font-normal`} placeholder="Customer Service Agent" /></label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Pronouns <span className="font-normal normal-case tracking-normal">(optional)</span><input maxLength={60} value={pronouns} onChange={event => setPronouns(event.target.value)} className={`${control} mt-1 normal-case tracking-normal font-normal`} placeholder="e.g. she/her, he/him, they/them" /></label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Support email<input value={crmSupportEmail} readOnly className={`${control} mt-1 cursor-not-allowed bg-slate-100 normal-case tracking-normal font-normal`} /></label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Website URL<input type="url" value={website} readOnly className={`${control} mt-1 cursor-not-allowed bg-slate-100 normal-case tracking-normal font-normal`} /></label>
      </div>
      <div className="mt-6 rounded-xl border border-purple-100 bg-purple-50 p-4"><p className="text-xs font-semibold text-slate-900">Brand voice</p><p className="mt-1 text-xs italic leading-5 text-slate-600">“I'm here for you—always. Creating a non-judgmental, private, and affirming space.”</p></div>
    </div>

    <div className="flex flex-col gap-5 lg:col-span-7">
      <div className="flex flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Live signature preview</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Ready to use</span></div>
        <p className="mb-4 text-xs text-slate-500">This is the HTML signature that will be added to new messages, replies, and drafts.</p>
        <div className="my-auto flex min-h-64 items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-inner" aria-label="Email signature preview">
          {signature ? <div className="w-full" dangerouslySetInnerHTML={{ __html: signatureHtml }} /> : <p className="text-sm text-slate-500">Enter your name and job title to preview your signature.</p>}
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
        <div className="mt-4 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={() => void copySignature()} disabled={!signature || busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy signature'}</button>
          <div className="flex justify-end gap-2">{!required && onCancel && <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>}<button type="button" onClick={() => void save()} disabled={!signature || busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{required ? 'Save and continue' : 'Save signature'}</button></div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-600 shadow-sm"><h2 className="font-semibold text-slate-900">How to add this to your email client</h2><p className="mt-1">Copy the signature to paste it into Outlook settings if you also send messages outside Q. Messages sent from the CRM use your saved signature automatically.</p></div>
    </div>
  </section>;
}
