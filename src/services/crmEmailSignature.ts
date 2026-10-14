export type CrmEmailSignature = {
  name: string;
  title: string;
  pronouns: string;
  website: string;
};

export type CrmEmailSignatureDraft = CrmEmailSignature;

const supportEmail = 'cs@q-ai.online';
const fixedWebsite = 'https://q-ai.online';
const logoUrl = 'https://brnhalxydcakutxiregp.supabase.co/storage/v1/object/public/images/Logo.png';

const clean = (value: unknown, maximum: number): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maximum) : '';

export function normalizeCrmEmailSignature(value: unknown): CrmEmailSignature | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const name = clean(source.name, 100);
  const title = clean(source.title, 120);
  const pronouns = clean(source.pronouns, 60);
  if (!name || !title) return null;
  return { name, title, pronouns, website: fixedWebsite };
}

export function signatureWebsiteLabel(website: string): string {
  try {
    const url = new URL(website);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
  } catch {
    return website;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function renderCrmEmailSignatureHtml(value: CrmEmailSignature): string {
  const signature = normalizeCrmEmailSignature(value);
  if (!signature) throw new Error('The saved CRM email signature is incomplete.');
  const name = escapeHtml(signature.name);
  const title = escapeHtml(signature.title);
  const pronouns = escapeHtml(signature.pronouns);
  const website = escapeHtml(signature.website);
  const websiteLabel = escapeHtml(signatureWebsiteLabel(signature.website));
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0F091F;max-width:520px;width:100%;margin-top:18px"><tbody><tr><td style="padding-right:20px;vertical-align:top;width:75px"><a href="https://q-ai.online" style="text-decoration:none"><img src="${logoUrl}" alt="Q Intelligence Logo" width="65" height="65" style="display:block;border-radius:12px;object-fit:contain;border:0"></a></td><td style="vertical-align:top;border-left:2px solid #f3e8ff;padding-left:18px"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tbody><tr><td style="padding-bottom:2px"><span style="font-size:16px;font-weight:700;color:#0F091F">${name}</span>${pronouns ? ` <span style="font-size:12px;font-weight:500;color:#64748b;background-color:#f8fafc;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0">${pronouns}</span>` : ''}</td></tr><tr><td style="padding-bottom:2px"><span style="font-size:13px;font-weight:700;color:#7c3aed">Q Intelligence</span></td></tr><tr><td style="padding-bottom:8px"><span style="font-size:13px;font-weight:600;color:#64748b">${title}</span></td></tr><tr><td style="padding-bottom:10px;font-size:12px;color:#64748b">Private support. Made for real life.</td></tr><tr><td style="padding-top:6px;border-top:1px solid #f1f5f9"><table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-size:12px"><tbody><tr><td style="padding-bottom:4px"><span style="color:#94a3b8">Email:</span> <a href="mailto:${supportEmail}" style="color:#7c3aed;text-decoration:none;font-weight:500">${supportEmail}</a></td></tr><tr><td><span style="color:#94a3b8">Web:</span> <a href="${website}" style="color:#7c3aed;text-decoration:none;font-weight:500">${websiteLabel}</a></td></tr></tbody></table></td></tr><tr><td style="padding-top:12px"><span style="font-size:10px;color:#94a3b8;font-style:italic">Your private space for LGBTQ+ wellbeing and personal reflection.</span></td></tr></tbody></table></td></tr></tbody></table>`;
}

export function renderCrmEmailHtml(message: string, signature: CrmEmailSignature): string {
  const body = escapeHtml(message).replace(/\r\n|\r|\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0F091F">${body}</div>${renderCrmEmailSignatureHtml(signature)}`;
}

export function renderCrmEmailSignatureText(value: CrmEmailSignature): string {
  const signature = normalizeCrmEmailSignature(value);
  if (!signature) return '';
  return `${signature.name}${signature.pronouns ? ` · ${signature.pronouns}` : ''}\nQ Intelligence\n${signature.title}\nPrivate support. Made for real life.\n\nEmail: ${supportEmail}\nWeb: ${signature.website}\n\nYour private space for LGBTQ+ wellbeing and personal reflection.`;
}

export const crmEmailSignatureLogoUrl = logoUrl;
export const crmSupportEmail = supportEmail;
export const crmSignatureWebsite = fixedWebsite;
