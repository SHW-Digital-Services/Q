import express from 'express';
import { requireStaff } from './admin.js';
import { asyncHandler } from '../middleware.js';
import { requireExactObject } from '../security.js';
import { MailError, mailConfig, sealMail, openMail, mailId, mailRecipients, ZohoMailClient, boundedResponse, allowedMailOrigin } from '../zohoMail.js';
import type { MailConfig, MailSession } from '../zohoMail.js';

type Dependencies = { authoriseStaff: typeof requireStaff; config: () => MailConfig | null; fetcher: typeof fetch; mailbox?: string; privateMailbox?: boolean };
type AttachmentProof = { owner: string; account: string; expires: number; attachment: { storeName: string; attachmentName: string; attachmentPath: string } };
const sessionCookie = 'q_zoho_mail';
const stateCookie = 'q_zoho_state';
const jsonBody = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const mailMessagePage = (messages: any[], hasMore: boolean) => ({ messages: messages.map(m => ({ messageId: String(m.messageId), folderId: String(m.folderId), subject: m.subject || '(No subject)', from: m.fromAddress || m.sender || '', to: m.toAddress || '', summary: m.summary || '', receivedAt: m.receivedTime || m.receivedtime || m.sentDateInGMT, unread: ['0', 'unread'].includes(String(m.status)), hasAttachment: ['1', 'true'].includes(String(m.hasAttachment)) })), hasMore });

export function createCommsRouter(dependencies: Dependencies) {
  const router = express.Router();
  const mailbox = dependencies.mailbox || 'office@q-ai.online';
  const isScott = (context: any) => context.identity.user.email?.toLowerCase() === 'scott@q-ai.online';
  if (!dependencies.privateMailbox) router.use('/personal', createCommsRouter({
    ...dependencies, mailbox: 'scott@q-ai.online', privateMailbox: true, config: () => mailConfig('ZOHO_SCOTT_MAIL'),
  }));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  router.get('/oauth/callback', (_req, res) => res.redirect('/crm/comms?connection=setup'));
  let sharedClient: ZohoMailClient | null = null;
  let sharedConfig: MailConfig | null = null;
  router.use(asyncHandler(async (req, res, next) => {
    const context = await dependencies.authoriseStaff(req, res); if (!context) return;
    if (dependencies.privateMailbox && !isScott(context)) return res.status(403).json({ error: 'This mailbox is private.' });
    res.locals.mailOwner = context.identity.user.id;
    res.locals.mailStaff = context;
    const config = dependencies.config(); res.locals.mailConfig = config;
    // Bearer authentication is required on all mail actions, including disconnect.
    if (req.method !== 'GET' && req.headers.origin && config && !allowedMailOrigin(req.headers.origin, config.appOrigin)) return res.status(403).json({ error: 'Open the communications portal on Q’s configured site address.' });
    next();
  }));
  router.get('/status', (_req, res) => {
    const config: MailConfig | null = res.locals.mailConfig;
    return res.json({ configured: Boolean(config), connected: Boolean(config), shared: !dependencies.privateMailbox, mailbox, personalAvailable: !dependencies.privateMailbox && isScott(res.locals.mailStaff), mailUrl: config?.mailOrigin || 'https://mail.zoho.eu', storage: 'zoho' });
  });
  router.post('/oauth/start', (_req, res) => res.status(409).json({ error: 'An admin configures mailbox connections in the server hosting settings.' }));
  // Logout must not revoke the shared credential and disconnect everyone else.
  router.post('/disconnect', (_req, res) => {
    for (const name of [sessionCookie, stateCookie]) res.append('Set-Cookie', `${name}=; Path=/api/comms; HttpOnly; SameSite=Lax; Max-Age=0`);
    return res.json({ disconnected: false, shared: true });
  });
  router.use(asyncHandler(async (req, res, next) => {
    const config: MailConfig | null = res.locals.mailConfig;
    if (!config?.refreshToken) return res.status(503).json({ error: `An admin needs to configure the ${mailbox} Zoho connection in Q hosting settings.` });
    if (!sharedClient || !sharedConfig || sharedConfig.clientId !== config.clientId || sharedConfig.clientSecret !== config.clientSecret || sharedConfig.refreshToken !== config.refreshToken || sharedConfig.mailOrigin !== config.mailOrigin || sharedConfig.accountsOrigin !== config.accountsOrigin) {
      const session: MailSession = { owner: mailbox, access: '', refresh: config.refreshToken, tokenExpires: 0, expires: Number.MAX_SAFE_INTEGER };
      sharedClient = new ZohoMailClient(config, session, () => {}, dependencies.fetcher);
      sharedConfig = { ...config };
    }
    res.locals.mailClient = sharedClient;
    const accounts = await sharedClient.json('/accounts');
    const matching = (Array.isArray(accounts) ? accounts : []).filter(a => String(a.primaryEmailAddress || a.mailboxAddress || '').toLowerCase() === mailbox);
    if (matching.length !== 1) throw new MailError(403, `The configured Zoho connection must belong to the ${mailbox} mailbox. Ask an admin to check the server credentials.`);
    res.locals.officeMailbox = matching[0];
    const requestedAccount = req.path.match(/^\/accounts\/([^/]+)/)?.[1];
    if (requestedAccount && mailId(requestedAccount) !== String(matching[0].accountId)) throw new MailError(403, 'This account is not available in the selected mailbox.');
    next();
  }));
  router.get('/accounts', asyncHandler(async (_req, res) => {
    const a = res.locals.officeMailbox;
    return res.json({ accounts: [{ accountId: String(a.accountId), email: mailbox, name: dependencies.privateMailbox ? 'Scott' : 'Q Office' }] });
  }));
  router.get('/customers/:user/history', asyncHandler(async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.user)) throw new MailError(400, 'Invalid customer.');
    const { data, error } = await res.locals.mailStaff.serviceSupabase.auth.admin.getUserById(req.params.user);
    if (error || !data?.user?.email) throw new MailError(404, 'Registered customer not found.');
    const email = String(data.user.email).toLowerCase();
    // Reject search syntax in addresses; the address is resolved server-side, never supplied by the caller.
    if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+$/i.test(email)) throw new MailError(400, 'This customer email cannot be searched in Zoho.');
    const start = Number(req.query.start || 1);
    if (!Number.isSafeInteger(start) || start < 1 || start > 100000) throw new MailError(400, 'Invalid page.');
    const client = res.locals.mailClient as ZohoMailClient;
    const account = String(res.locals.officeMailbox.accountId);
    const query = new URLSearchParams({ searchKey: `sender:"${email}"::or:to:"${email}"::or:cc:"${email}"`, start: String(start), limit: '30', includeto: 'true', receivedTime: String(Date.now()) });
    const [messages, folders] = await Promise.all([client.json(`/accounts/${account}/messages/search?${query}`), client.json(`/accounts/${account}/folders`)]);
    if (!Array.isArray(messages) || !Array.isArray(folders)) throw new MailError(502, 'Zoho did not return valid customer email history.');
    const excluded = new Set(folders.filter(f => ['drafts', 'outbox', 'templates'].includes(String(f.folderType).toLowerCase())).map(f => String(f.folderId)));
    const addresses = (value: unknown) => (String(value || '').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+/gi) || []).map(address => address.toLowerCase());
    const history = new Map<string, unknown>();
    for (const message of messages) {
      if (excluded.has(String(message.folderId))) continue;
      const from = addresses(message.fromAddress);
      const recipients = addresses([message.toAddress, message.ccAddress, message.bccAddress].filter(Boolean).join(','));
      const inbound = from.includes(email);
      if (!inbound && !(from.includes(mailbox) && recipients.includes(email))) continue;
      const id = String(message.messageId);
      const date = new Date(Number(message.receivedTime || message.receivedtime || message.sentDateInGMT));
      history.set(id, { id: `zoho-${id}`, messageId: id, folderId: String(message.folderId), accountId: account, direction: inbound ? 'inbound' : 'outbound', channel: 'email', status: inbound ? 'received' : 'sent', sender_email: message.fromAddress || '', recipient_email: inbound ? mailbox : email, subject: message.subject || '(No subject)', body: 'Email held in Zoho. Open Communications to read it.', created_at: Number.isNaN(date.getTime()) ? '' : date.toISOString() });
    }
    return res.json({ communications: [...history.values()], hasMore: messages.length === 30, storage: 'zoho' });
  }));
  router.get('/accounts/:account/folders', asyncHandler(async (req, res) => {
    const folders = await (res.locals.mailClient as ZohoMailClient).json(`/accounts/${mailId(req.params.account)}/folders`);
    if (!Array.isArray(folders)) throw new MailError(502, 'Zoho did not return a valid folder list. Try refreshing or open Zoho Mail.');
    return res.json({ folders: folders.map(f => ({ folderId: String(f.folderId), name: f.folderName, type: String(f.folderType || ''), path: f.path })) });
  }));
  router.get('/accounts/:account/messages', asyncHandler(async (req, res) => {
    const start = Number(req.query.start || 1);
    if (!Number.isSafeInteger(start) || start < 1 || start > 100000) throw new MailError(400, 'Invalid page.');
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 300) throw new MailError(400, 'Keep the search under 300 characters.');
    const query = new URLSearchParams({ start: String(start), limit: '30', includeto: 'true' });
    if (search) { query.set('searchKey', search); query.set('receivedTime', String(Date.now())); }
    else { query.set('folderId', mailId(req.query.folder)); query.set('includesent', 'true'); query.set('includearchive', 'true'); query.set('status', 'all'); query.set('sortBy', 'date'); query.set('sortorder', 'false'); }
    const client = res.locals.mailClient as ZohoMailClient;
    const accountPath = `/accounts/${mailId(req.params.account)}`;
    let messages = await client.json(`${accountPath}/messages/${search ? 'search' : 'view'}?${query}`);
    if (!Array.isArray(messages)) throw new MailError(502, 'Zoho did not return a valid message list. Try refreshing or open Zoho Mail.');
    let source = search ? 'search' : 'folder';
    if (!search && messages.length === 0) {
      // Try the provider's basic folder view before assuming the inbox is empty.
      const basic = new URLSearchParams({ folderId: mailId(req.query.folder), start: String(start), limit: '30', includeto: 'true' });
      messages = await client.json(`${accountPath}/messages/view?${basic}`);
      if (!Array.isArray(messages)) throw new MailError(502, 'Zoho did not return a valid message list. Try refreshing or open Zoho Mail.');
      source = 'basic-folder';
      if (messages.length === 0) {
        const folders = await client.json(`${accountPath}/folders`);
        if (!Array.isArray(folders)) throw new MailError(502, 'Zoho did not return a valid folder list.');
        const folder = folders.find(f => String(f.folderId) === req.query.folder);
        if (!folder) throw new MailError(404, 'This folder is no longer available. Reload Communications.');
        const name = String(folder.folderName || '');
        if (name && !/["\r\n\\]/.test(name)) {
          const fallbackQuery = new URLSearchParams({ searchKey: `in:"${name}"`, receivedTime: String(Date.now()), start: String(start), limit: '30', includeto: 'true' });
          const results = await client.json(`${accountPath}/messages/search?${fallbackQuery}`);
          if (!Array.isArray(results)) throw new MailError(502, 'Zoho did not return a valid message list.');
          // Folder-name searches can match more than one folder. Never mix them.
          messages = results.filter(m => String(m.folderId) === req.query.folder);
          source = 'folder-search';
          return res.json({ ...mailMessagePage(messages, results.length === 30), source });
        }
      }
    }
    return res.json({ ...mailMessagePage(messages, messages.length === 30), source });
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
    const payload: any = { fromAddress: mailbox, toAddress: mailRecipients(req.body.to, true), ccAddress: mailRecipients(req.body.cc || ''), bccAddress: mailRecipients(req.body.bcc || ''), subject: subject.trim(), content, mailFormat: 'plaintext', encoding: 'UTF-8' };
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
