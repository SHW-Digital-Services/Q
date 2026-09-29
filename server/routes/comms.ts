import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { requireStaff } from './admin.js';
import { asyncHandler } from '../middleware.js';
import { requireExactObject } from '../security.js';
import { MailError, mailConfig, MAIL_SCOPES, sealMail, openMail, cookieValue, setMailCookie, validMailSession, mailId, mailRecipients, tokenRequest, ZohoMailClient, boundedResponse } from '../zohoMail.js';
import type { MailConfig, MailSession } from '../zohoMail.js';

type Dependencies = { authoriseStaff: typeof requireStaff; config: () => MailConfig | null; fetcher: typeof fetch };
type OAuthState = { owner: string; nonce: string; expires: number };
type AttachmentProof = { owner: string; account: string; expires: number; attachment: { storeName: string; attachmentName: string; attachmentPath: string } };
const sessionCookie = 'q_zoho_mail';
const stateCookie = 'q_zoho_state';
const jsonBody = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function createCommsRouter(dependencies: Dependencies) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  // A top-level OAuth return cannot carry the Q bearer token. The encrypted,
  // short-lived state cookie binds it to the staff identity verified at start.
  router.get('/oauth/callback', asyncHandler(async (req, res) => {
    const config = dependencies.config(); if (!config) return res.redirect('/crm/comms?connection=setup');
    const state = openMail<OAuthState>(cookieValue(req, stateCookie), config.key, 'state');
    setMailCookie(res, config, stateCookie, '', 0);
    const nonce = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state || state.expires < Date.now() || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || nonce.length !== state.nonce.length || !timingSafeEqual(Buffer.from(nonce), Buffer.from(state.nonce))) return res.redirect('/crm/comms?connection=invalid');
    if (req.query.error || typeof req.query.code !== 'string' || req.query.code.length > 512) return res.redirect('/crm/comms?connection=denied');
    try {
      const data = await tokenRequest(config, { grant_type: 'authorization_code', code: req.query.code, redirect_uri: config.redirectUri }, dependencies.fetcher);
      const session: MailSession = { owner: state.owner, access: data.access_token, refresh: typeof data.refresh_token === 'string' ? data.refresh_token : '', tokenExpires: Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1000, expires: Date.now() + 8 * 3600 * 1000 };
      setMailCookie(res, config, sessionCookie, sealMail(session, config.key, 'session'), 8 * 3600);
      return res.redirect('/crm/comms?connection=connected');
    } catch { return res.redirect('/crm/comms?connection=failed'); }
  }));
  router.use(asyncHandler(async (req, res, next) => {
    const context = await dependencies.authoriseStaff(req, res); if (!context) return;
    res.locals.mailOwner = context.identity.user.id;
    const config = dependencies.config(); res.locals.mailConfig = config;
    // Bearer authentication is required on all mail actions, including disconnect.
    if (req.method !== 'GET' && req.headers.origin && config && req.headers.origin !== config.appOrigin) return res.status(403).json({ error: 'Open the communications portal on Q’s configured site address.' });
    next();
  }));
  router.get('/status', (req, res) => {
    const config: MailConfig | null = res.locals.mailConfig;
    const session = config ? openMail<MailSession>(cookieValue(req, sessionCookie), config.key, 'session') : null;
    return res.json({ configured: Boolean(config), connected: validMailSession(session, res.locals.mailOwner), mailUrl: config?.mailOrigin || 'https://mail.zoho.eu', storage: 'zoho' });
  });
  router.post('/oauth/start', (req, res) => {
    const config: MailConfig | null = res.locals.mailConfig;
    if (!config) return res.status(503).json({ error: 'An admin needs to configure Q’s Zoho Mail application first.' });
    const state: OAuthState = { owner: res.locals.mailOwner, nonce: randomBytes(32).toString('base64url'), expires: Date.now() + 10 * 60000 };
    setMailCookie(res, config, stateCookie, sealMail(state, config.key, 'state'), 600);
    const params = new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: config.redirectUri, scope: MAIL_SCOPES, access_type: 'offline', prompt: 'consent', state: state.nonce });
    return res.json({ url: `${config.accountsOrigin}/oauth/v2/auth?${params}` });
  });
  router.post('/disconnect', asyncHandler(async (req, res) => {
    const config: MailConfig | null = res.locals.mailConfig;
    let revoked = true;
    if (config) {
      const session = openMail<MailSession>(cookieValue(req, sessionCookie), config.key, 'session');
      setMailCookie(res, config, sessionCookie, '', 0); setMailCookie(res, config, stateCookie, '', 0);
      if (session?.owner === res.locals.mailOwner) {
        try {
          const response = await dependencies.fetcher(`${config.accountsOrigin}/oauth/v2/token/revoke`, { method: 'POST', body: new URLSearchParams({ token: session.refresh || session.access }), redirect: 'error', signal: AbortSignal.timeout(10000) });
          const data = JSON.parse((await boundedResponse(response, 32768)).toString());
          revoked = response.ok && !data.error;
        } catch { revoked = false; }
      }
    } else {
      // Clear locally even if configuration was removed since connection.
      res.append('Set-Cookie', `${sessionCookie}=; Path=/api/comms; HttpOnly; SameSite=Lax; Max-Age=0`);
      res.append('Set-Cookie', `${stateCookie}=; Path=/api/comms; HttpOnly; SameSite=Lax; Max-Age=0`);
    }
    return res.json({ disconnected: true, revoked });
  }));
  router.use((req, res, next) => {
    const config: MailConfig | null = res.locals.mailConfig;
    if (!config) return res.status(503).json({ error: 'An admin needs to configure Q’s Zoho Mail application first.' });
    const session = openMail<MailSession>(cookieValue(req, sessionCookie), config.key, 'session');
    if (!validMailSession(session, res.locals.mailOwner)) return res.status(401).json({ error: 'Connect your Zoho mailbox to continue.', code: 'MAIL_CONNECTION_REQUIRED' });
    res.locals.mailClient = new ZohoMailClient(config, session, () => setMailCookie(res, config, sessionCookie, sealMail(session, config.key, 'session'), (session.expires - Date.now()) / 1000), dependencies.fetcher);
    next();
  });
  // No service database is supplied to mail routes. Zoho checks that every
  // requested account/folder/message belongs to the connected OAuth principal.
  router.get('/accounts', asyncHandler(async (_req, res) => {
    const accounts = await (res.locals.mailClient as ZohoMailClient).json('/accounts');
    return res.json({ accounts: (Array.isArray(accounts) ? accounts : []).map(a => ({ accountId: String(a.accountId), email: a.primaryEmailAddress || a.mailboxAddress, name: a.displayName || a.accountName })) });
  }));
  router.get('/accounts/:account/folders', asyncHandler(async (req, res) => {
    const folders = await (res.locals.mailClient as ZohoMailClient).json(`/accounts/${mailId(req.params.account)}/folders`);
    return res.json({ folders: (Array.isArray(folders) ? folders : []).map(f => ({ folderId: String(f.folderId), name: f.folderName, type: f.folderType, path: f.path })) });
  }));
  router.get('/accounts/:account/messages', asyncHandler(async (req, res) => {
    const start = Number(req.query.start || 1);
    if (!Number.isSafeInteger(start) || start < 1 || start > 100000) throw new MailError(400, 'Invalid page.');
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 300) throw new MailError(400, 'Keep the search under 300 characters.');
    const query = new URLSearchParams({ start: String(start), limit: '30', includeto: 'true' });
    if (search) { query.set('searchKey', search); query.set('receivedTime', String(Date.now())); }
    else { query.set('folderId', mailId(req.query.folder)); query.set('includesent', 'true'); query.set('includearchive', 'true'); }
    const messages = await (res.locals.mailClient as ZohoMailClient).json(`/accounts/${mailId(req.params.account)}/messages/${search ? 'search' : 'view'}?${query}`);
    return res.json({ messages: (Array.isArray(messages) ? messages : []).map(m => ({ messageId: String(m.messageId), folderId: String(m.folderId), subject: m.subject || '(No subject)', from: m.fromAddress || m.sender || '', to: m.toAddress || '', summary: m.summary || '', receivedAt: m.receivedTime || m.receivedtime || m.sentDateInGMT, unread: ['0', 'unread'].includes(String(m.status)), hasAttachment: ['1', 'true'].includes(String(m.hasAttachment)) })), hasMore: Array.isArray(messages) && messages.length === 30 });
  }));
  const messagePath = (req: express.Request) => `/accounts/${mailId(req.params.account)}/folders/${mailId(req.params.folder)}/messages/${mailId(req.params.message)}`;
  router.get('/accounts/:account/folders/:folder/messages/:message', asyncHandler(async (req, res) => {
    const client = res.locals.mailClient as ZohoMailClient;
    const [content, info] = await Promise.all([client.json(`${messagePath(req)}/content?includeBlockContent=true`), client.json(`${messagePath(req)}/attachmentinfo`)]);
    return res.json({ content: content?.content || '', attachments: (info?.attachments || []).map(a => ({ id: String(a.attachmentId), name: a.attachmentName, size: a.attachmentSize })) });
  }));
  router.get('/accounts/:account/folders/:folder/messages/:message/attachments/:attachment', asyncHandler(async (req, res) => {
    const response = await (res.locals.mailClient as ZohoMailClient).response(`${messagePath(req)}/attachments/${mailId(req.params.attachment)}`);
    const bytes = await boundedResponse(response, 20 * 1024 * 1024);
    res.setHeader('Content-Type', 'application/octet-stream');
    // Force a download; never serve potentially active mail attachments inline.
    res.setHeader('Content-Disposition', 'attachment; filename="mail-attachment"');
    return res.send(bytes);
  }));
  router.post('/accounts/:account/attachments', express.raw({ type: 'application/octet-stream', limit: '3mb' }), asyncHandler(async (req, res) => {
    const account = mailId(req.params.account);
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    if (!name || name.length > 180 || /[\x00-\x1f/\\]/.test(name) || !Buffer.isBuffer(req.body) || !req.body.length || req.body.length > 3 * 1024 * 1024) throw new MailError(400, 'Choose an attachment up to 3 MB with a valid file name.');
    const data = await (res.locals.mailClient as ZohoMailClient).json(`/accounts/${account}/messages/attachments?${new URLSearchParams({ fileName: name, isInline: 'false' })}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: req.body });
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.storeName || !result?.attachmentPath || !result?.attachmentName) throw new MailError(502, 'Zoho did not confirm the attachment upload.');
    const proof: AttachmentProof = { owner: res.locals.mailOwner, account, expires: Date.now() + 8 * 3600 * 1000, attachment: { storeName: result.storeName, attachmentName: result.attachmentName, attachmentPath: result.attachmentPath } };
    return res.json({ attachment: { name, proof: sealMail(proof, res.locals.mailConfig.key, 'attachment') } });
  }));
  router.post('/accounts/:account/send', asyncHandler(async (req, res) => {
    if (!requireExactObject(req.body, ['to', 'cc', 'bcc', 'subject', 'content', 'replyTo', 'attachments', 'draft'])) throw new MailError(400, 'Invalid email fields.');
    const account = mailId(req.params.account);
    const { subject, content, replyTo, attachments = [], draft = false } = req.body;
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 300 || /[\r\n]/.test(subject) || typeof content !== 'string' || !content.trim() || content.length > 50000 || typeof draft !== 'boolean' || (replyTo !== undefined && replyTo !== '' && !/^\d{1,30}$/.test(replyTo)) || !Array.isArray(attachments) || attachments.length > 10) throw new MailError(400, 'Enter a subject (up to 300 characters) and message (up to 50,000 characters).');
    if (!draft && /\{\{[^{}]+\}\}/.test(`${subject}\n${content}`)) throw new MailError(400, 'Complete all template placeholders before sending.');
    if (draft && replyTo) throw new MailError(400, 'Reply drafts are kept open in Q. Save a new message as a Zoho draft instead.');
    const client = res.locals.mailClient as ZohoMailClient;
    const accounts = await client.json('/accounts');
    const mailbox = Array.isArray(accounts) ? accounts.find(a => String(a.accountId) === account) : null;
    if (!mailbox) throw new MailError(403, 'This mailbox is not connected to your Zoho account.');
    const payload: any = { fromAddress: mailbox.primaryEmailAddress || mailbox.mailboxAddress, toAddress: mailRecipients(req.body.to, true), ccAddress: mailRecipients(req.body.cc || ''), bccAddress: mailRecipients(req.body.bcc || ''), subject: subject.trim(), content, mailFormat: 'plaintext', encoding: 'UTF-8' };
    payload.attachments = attachments.map(proof => {
      if (typeof proof !== 'string') throw new MailError(400, 'Invalid attachment.');
      const data = openMail<AttachmentProof>(proof, res.locals.mailConfig.key, 'attachment');
      if (!data || data.owner !== res.locals.mailOwner || data.account !== account || data.expires < Date.now()) throw new MailError(400, 'This attachment has expired or belongs to another mailbox. Please upload it again.');
      return data.attachment;
    });
    if (!payload.attachments.length) delete payload.attachments;
    if (draft) payload.mode = 'draft';
    if (replyTo) payload.action = 'reply';
    await client.json(`/accounts/${account}/messages${replyTo ? `/${mailId(replyTo)}` : ''}`, jsonBody(payload));
    return res.json({ success: true, draft });
  }));
  router.patch('/accounts/:account/messages/:message', asyncHandler(async (req, res) => {
    if (!requireExactObject(req.body, ['action', 'folderId']) || !['read', 'unread', 'archive', 'move'].includes(req.body.action)) throw new MailError(400, 'Choose a valid email action.');
    const mode = { read: 'markAsRead', unread: 'markAsUnread', archive: 'archiveMails', move: 'moveMessage' }[req.body.action as string];
    const payload = { mode, messageId: [mailId(req.params.message)], ...(req.body.action === 'move' ? { destfolderId: mailId(req.body.folderId) } : {}) };
    await (res.locals.mailClient as ZohoMailClient).json(`/accounts/${mailId(req.params.account)}/updatemessage`, { ...jsonBody(payload), method: 'PUT' });
    return res.json({ success: true });
  }));
  router.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Never log provider bodies, email text, addresses or credential material.
    const tooLarge = (err as any)?.type === 'entity.too.large';
    return res.status(tooLarge ? 413 : err instanceof MailError ? err.status : 502).json({ error: tooLarge ? 'Choose an attachment up to 3 MB.' : err instanceof MailError ? err.message : 'Zoho is temporarily unavailable. If you were sending, check Sent in Zoho before trying again.' });
  });
  return router;
}
export const commsRouter = createCommsRouter({ authoriseStaff: requireStaff, config: mailConfig, fetcher: fetch });
