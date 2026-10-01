import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { getCanonicalAppUrl } from './middleware.js';

const regions = { eu: 'eu', us: 'com', in: 'in', au: 'com.au', jp: 'jp', ca: 'ca', sa: 'sa', cn: 'com.cn' } as const;
export class MailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type MailConfig = { clientId: string; clientSecret: string; refreshToken: string; key: Buffer; accountsOrigin: string; mailOrigin: string; redirectUri: string; appOrigin: string; secure: boolean };
export function mailConfig(prefix = 'ZOHO_MAIL'): MailConfig | null {
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  const key = process.env[`${prefix}_COOKIE_KEY`]?.trim();
  const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`]?.trim();
  const region = process.env[`${prefix}_REGION`]?.trim() || 'eu';
  if (!clientId || !clientSecret || !refreshToken || !key || !/^[a-f0-9]{64}$/i.test(key) || !(region in regions)) return null;
  const suffix = regions[region as keyof typeof regions];
  const appOrigin = getCanonicalAppUrl();
  return { clientId, clientSecret, refreshToken, key: Buffer.from(key, 'hex'), accountsOrigin: `https://accounts.zoho.${suffix}`, mailOrigin: `https://mail.zoho.${suffix}`, redirectUri: `${appOrigin}/api/comms/oauth/callback`, appOrigin, secure: new URL(appOrigin).protocol === 'https:' };
}
export const MAIL_SCOPES = 'ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ,ZohoMail.messages.CREATE,ZohoMail.messages.UPDATE';
export function allowedMailOrigin(origin: string, configured: string): boolean {
  if (origin === configured) return true;
  try {
    const candidate = new URL(origin); const canonical = new URL(configured);
    const hosts = new Set(['q-ai.online', 'www.q-ai.online']);
    return origin === candidate.origin && candidate.protocol === 'https:' && canonical.protocol === 'https:' && !candidate.port && !canonical.port && hosts.has(candidate.hostname) && hosts.has(canonical.hostname);
  } catch { return false; }
}
export function sealMail(value: unknown, key: Buffer, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`q-zoho:${purpose}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openMail<T>(value: string | undefined, key: Buffer, purpose: string): T | null {
  try {
    if (!value || value.length > 6000) return null;
    const bytes = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`q-zoho:${purpose}`)); decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
  } catch { return null; }
}
export function cookieValue(req: Request, name: string): string | undefined {
  const matches = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : undefined;
}
export function setMailCookie(res: Response, config: MailConfig, name: string, value: string, seconds: number) {
  if (value.length > 3600) throw new MailError(502, 'Zoho returned credentials that cannot fit a secure mail session.');
  res.append('Set-Cookie', `${name}=${value}; Path=/api/comms; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(seconds))}${config.secure ? '; Secure' : ''}`);
}
export type MailSession = { owner: string; access: string; refresh: string; tokenExpires: number; expires: number };
export function validMailSession(session: MailSession | null, owner: string, now = Date.now()): session is MailSession {
  return Boolean(session && session.owner === owner && session.expires > now && typeof session.access === 'string' && typeof session.refresh === 'string' && Number.isFinite(session.tokenExpires));
}
export function mailId(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,30}$/.test(value)) throw new MailError(400, 'Invalid mailbox, folder, message or attachment.');
  return value;
}
// Zoho sometimes sends 19-digit IDs as JSON numbers. Preserve their exact
// digits before parsing; converting an already parsed Number would round them.
export function parseZohoJson(text: string): any {
  return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (token.startsWith('"')) return token;
    return /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token)) ? JSON.stringify(token) : token;
  }));
}
export async function boundedResponse(response: globalThis.Response, maximum: number): Promise<Buffer> {
  if (Number(response.headers.get('content-length')) > maximum) { await response.body?.cancel(); throw new MailError(413, 'This item is too large to open in Q. Please open it in Zoho Mail.'); }
  const reader = response.body?.getReader(); if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maximum) { await reader.cancel(); throw new MailError(413, 'This item is too large to open in Q. Please open it in Zoho Mail.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function tokenRequest(config: MailConfig, values: Record<string, string>, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${config.accountsOrigin}/oauth/v2/token`, { method: 'POST', body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values }), redirect: 'error', signal: AbortSignal.timeout(15000) });
  const text = await boundedResponse(response, 32 * 1024);
  let data: any; try { data = JSON.parse(text.toString()); } catch { throw new MailError(502, 'Zoho authentication is temporarily unavailable.'); }
  if (!response.ok || data?.error || typeof data?.access_token !== 'string' || data.access_token.length > 1500) {
    // Use only known error names and our own explanations. Provider descriptions
    // can echo credentials; never return or log those response bodies.
    const messages: Record<string, string> = {
      invalid_client: 'Zoho rejected the application credentials (invalid_client). Check that ZOHO_MAIL_CLIENT_ID and ZOHO_MAIL_CLIENT_SECRET belong to the same Self Client, and that ZOHO_MAIL_REGION matches its data centre.',
      invalid_client_secret: 'Zoho rejected the application secret (invalid_client_secret). Update ZOHO_MAIL_CLIENT_SECRET with the secret for the configured Client ID.',
      invalid_code: 'Zoho rejected the refresh token (invalid_code). ZOHO_MAIL_REFRESH_TOKEN must contain the refresh token returned by the setup helper, not the short-lived Generate Code grant or an access token. Check that it belongs to the same Client ID and Zoho region; regenerate it if revoked.',
      invalid_grant: 'Zoho rejected the authorisation (invalid_grant). Generate a new office mailbox refresh token using the same Client ID, secret and Zoho region configured in Q.',
      access_denied: 'Zoho denied the office mailbox authorisation (access_denied). Check the office account authorisation and its API permissions.',
    };
    const recognised = typeof data?.error === 'string' && Object.hasOwn(messages, data.error) ? messages[data.error] : null;
    if (response.status === 429) throw new MailError(429, 'Zoho authentication is rate limited. Wait before refreshing Communications again.');
    if (response.status >= 500) throw new MailError(502, 'Zoho authentication is temporarily unavailable. Try again later.');
    throw new MailError(401, recognised ? `${recognised} Redeploy Q after updating hosting settings.` : 'Zoho could not authorise office@q-ai.online. Check the matching Client ID, Client Secret, refresh token and region in Q hosting settings, then redeploy.');
  }
  return data;
}
export class ZohoMailClient {
  private refreshing: Promise<void> | null = null;
  constructor(public config: MailConfig, public session: MailSession, private onRefresh: () => void, private fetcher: typeof fetch = fetch) {}
  async response(path: string, init: RequestInit = {}, retry = true): Promise<globalThis.Response> {
    if (this.session.tokenExpires <= Date.now() + 60000) await this.refresh();
    const response = await this.fetcher(`${this.config.mailOrigin}/api${path}`, { ...init, headers: { ...init.headers, Authorization: `Zoho-oauthtoken ${this.session.access}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (response.status === 401 && retry && this.session.refresh) { await response.body?.cancel(); await this.refresh(); return this.response(path, init, false); }
    if (!response.ok) { await response.body?.cancel(); throw new MailError(response.status === 403 ? 403 : response.status === 429 ? 429 : response.status === 401 ? 401 : 502, response.status === 403 ? 'Zoho has not allowed this action. Check mailbox permissions, OAuth scopes and your plan’s API access.' : response.status === 429 ? 'Zoho is busy. Please wait before trying again.' : response.status === 401 ? 'Your Zoho connection has expired. Please reconnect.' : 'Zoho could not complete this request. For a send attempt, check Sent in Zoho before trying again.'); }
    return response;
  }
  async json(path: string, init: RequestInit = {}) {
    const response = await this.response(path, init);
    let result: any; try { result = parseZohoJson((await boundedResponse(response, 5 * 1024 * 1024)).toString()); } catch (error) { if (error instanceof MailError) throw error; throw new MailError(502, 'Zoho returned an unreadable response.'); }
    if (result.status?.code && Number(result.status.code) >= 400) throw new MailError(Number(result.status.code) === 403 ? 403 : 502, 'Zoho could not complete this action. Check your mailbox and plan permissions.');
    return result.data;
  }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refreshToken();
    try { await this.refreshing; } finally { this.refreshing = null; }
  }
  private async refreshToken() {
    if (!this.session.refresh) throw new MailError(401, 'Reconnect your Zoho mailbox.');
    const data = await tokenRequest(this.config, { grant_type: 'refresh_token', refresh_token: this.session.refresh }, this.fetcher);
    this.session.access = data.access_token;
    this.session.tokenExpires = Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1000;
    this.onRefresh();
  }
}
export function mailRecipients(value: unknown, required = false): string {
  if (typeof value !== 'string' || value.length > 3000 || /[\r\n]/.test(value)) throw new MailError(400, 'Enter valid email addresses separated by commas.');
  const list = value.split(',').map(s => s.trim()).filter(Boolean);
  if ((required && !list.length) || list.length > 25 || list.some(s => !/^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(s))) throw new MailError(400, 'Enter valid email addresses separated by commas (up to 25).');
  return list.join(',');
}
