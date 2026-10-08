import assert from 'node:assert/strict';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { createCommsRouter } from '../server/routes/comms';
import { createAdminDeleteUsersRouter } from '../server/routes/adminDeleteUsers';
import { sealMail, openMail, validMailSession, MailSession, MailConfig, mailRecipients, ZohoMailClient, parseZohoJson, tokenRequest, allowedMailOrigin } from '../server/zohoMail';
import { emailTemplates, fillEmailTemplate, templatePlaceholders } from '../src/data/emailTemplates';
import { combinedInboxFolders, visibleMailFolders, inboxFolder, trashFolder } from '../src/services/mailFolders';

const owner = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
const key = randomBytes(32);
const config: MailConfig = { clientId: 'fixture-client', clientSecret: 'fixture-secret', refreshToken: 'fixture-refresh', key, accountsOrigin: 'https://accounts.zoho.eu', mailOrigin: 'https://mail.zoho.eu', redirectUri: '', appOrigin: '', secure: false };
const session: MailSession = { owner, access: 'fixture-access', refresh: 'fixture-refresh', expires: Date.now() + 3600000, tokenExpires: Date.now() + 3600000 };
const calls: { url: URL; init: RequestInit }[] = [];
let providerStatus = 200; let mailboxEmail = 'office@q-ai.online'; let malformedMessages = false; let emptyView: 'none' | 'extended' | 'all' = 'none';
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ status: { code: status }, data }), { status, headers: { 'Content-Type': 'application/json' } });
const fetcher = (async (url: any, init: RequestInit = {}) => {
  const parsed = new URL(String(url)); calls.push({ url: parsed, init });
  if (parsed.pathname === '/oauth/v2/token') return new Response(JSON.stringify({ access_token: 'fixture-refreshed', refresh_token: 'fixture-refresh', expires_in: 3600 }));
  if (parsed.pathname === '/oauth/v2/token/revoke') return new Response(JSON.stringify({ status: 'success' }));
  if (providerStatus !== 200) return json({ private: 'DO_NOT_LEAK_PROVIDER_BODY' }, providerStatus);
  if (parsed.pathname === '/api/accounts') return json([{ accountId: '10001', primaryEmailAddress: mailboxEmail, displayName: 'Q Office' }, { accountId: '99999', primaryEmailAddress: 'other@example.test' }]);
  if (parsed.pathname.endsWith('/folders')) return json([{ folderId: '20001', folderName: 'Inbox', folderType: 'Inbox', unreadCount: '7' }, { folderId: '20002', folderName: 'Sent', folderType: 'Sent' }, { folderId: '20003', folderName: 'Drafts', folderType: 'Drafts' }, { folderId: '20004', folderName: 'Archive', folderType: 'Archive' }, {folderId:'20006',folderName:'Notification',folderType:'Inbox',unreadCount:2}, {folderId:'20007',folderName:'Newsletter',folderType:'Inbox',unreadCount:3}]);
  if (parsed.pathname.endsWith('/view') && (emptyView === 'all' || emptyView === 'extended' && parsed.searchParams.has('includearchive'))) return json([]);
  if (parsed.pathname.endsWith('/search') && parsed.searchParams.get('searchKey')?.startsWith('sender:')) return json([
    { messageId: '601', folderId: '20001', fromAddress: 'Visitor <visitor@example.test>', toAddress: 'office@q-ai.online', receivedTime: Date.now(), subject: 'Inbound', summary: 'PRIVATE_BODY_NOT_HISTORY' },
    { messageId: '602', folderId: '20002', fromAddress: 'office@q-ai.online', toAddress: 'visitor@example.test', receivedTime: Date.now(), subject: 'Sent' },
    { messageId: '602', folderId: '20002', fromAddress: 'office@q-ai.online', toAddress: 'visitor@example.test', receivedTime: Date.now(), subject: 'Sent' },
    { messageId: '603', folderId: '20003', fromAddress: 'office@q-ai.online', toAddress: 'visitor@example.test', receivedTime: Date.now(), subject: 'Unsent draft' },
    { messageId: '604', folderId: '20002', fromAddress: 'office@q-ai.online', toAddress: 'othervisitor@example.test', receivedTime: Date.now(), subject: 'Unrelated' },
    { messageId: '605', folderId: '20002', fromAddress: 'office@q-ai.online', toAddress: 'other@example.test', ccAddress: 'visitor@example.test', receivedTime: Date.now(), subject: 'Cc' }
  ]);
  if (parsed.pathname.endsWith('/search') && parsed.searchParams.get('searchKey')?.includes('::or:in:')) return json([
    {messageId:'701',folderId:'20007',subject:'Newsletter',receivedTime:'3000'},
    {messageId:'702',folderId:'20006',subject:'Notification',receivedTime:'2000'},
    {messageId:'703',folderId:'20001',subject:'Inbox',receivedTime:'1000'},
    {messageId:'703',folderId:'20001',subject:'Duplicate'},
    {messageId:'704',folderId:'20002',subject:'Excluded sent message'},
  ]);
  if (/\/messages\/(view|search)$/.test(parsed.pathname)) return json(malformedMessages ? {} : [{ messageId: '30001', folderId: '20001', subject: 'Help getting started', fromAddress: 'visitor@example.test', toAddress: 'office@q-ai.online', receivedTime: String(Date.now()), status: '0', hasAttachment: '1' }]);
  if (parsed.pathname.endsWith('/content')) return json({ content: '<p>Hello Q team,</p><p>Could you help me get started?</p><img src="https://tracking.example.test/pixel" onerror="alert(1)"><script>window.BAD_MAIL=true</script><form action="https://example.test"><input name="password"></form><p><strong>Thank you.</strong></p>' });
  if (parsed.pathname.endsWith('/attachmentinfo')) return json({ attachments: [{ attachmentId: '40001', attachmentName: 'example.txt', attachmentSize: 7 }], inline: [{ cid: 'fixture-image', attachmentName: 'logo.png', attachmentSize: 8 }, { cid: 'unsafe-image', attachmentName: 'bad.svg', attachmentSize: 20 }] });
  if (parsed.pathname.endsWith('/inline')) return new Response(parsed.searchParams.get('contentId') === 'fixture-image' ? Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) : Buffer.from('<svg onload="alert(1)"/>'));
  if (parsed.pathname.endsWith('/attachments/40001')) return new Response('example', { headers: { 'Content-Type': 'text/html' } });
  if (parsed.pathname.endsWith('/messages/attachments')) return json([{ storeName: 'fixture-store', attachmentName: parsed.searchParams.get('fileName'), attachmentPath: '/Mail/fixture.txt' }]);
  return json({ messageId: '50001' });
}) as typeof fetch;
const authoriseStaff = (async (req: any, res: any) => {
  if (!req.headers.authorization) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  if (!['Bearer fixture-staff', 'Bearer fixture-admin', 'Bearer fixture-other'].includes(req.headers.authorization)) { res.status(403).json({ error: 'Staff access required.' }); return null; }
  return { identity: { user: { id: req.headers.authorization === 'Bearer fixture-other' ? target : owner } }, role: 'staff', permissions: req.headers.authorization==='Bearer fixture-other'?['support.read']:[], serviceSupabase: { rpc: async()=>({error:null}), auth: { admin: { listUsers:async()=>({data:{users:[{id:target,email:'visitor@example.test',email_confirmed_at:'2026-01-01'}]}}),getUserById: async (id: string) => ({ data: { user: id === target ? { id: target, email: 'visitor@example.test' } : null } }) } } } };
}) as any;
let configured = true;
const app = express(); app.use(express.json({ limit: '256kb' }));
app.use('/api/comms', createCommsRouter({ authoriseStaff, config: () => configured ? config : null, fetcher }));
let deletionRole = 'user'; let subscriptionStatus = ''; let deletes = 0; const audits: any[] = [];
const deletionDb = {
  auth: { admin: { getUserById: async () => ({ data: { user: { id: target, email: 'visitor@example.test' } } }), deleteUser: async () => { deletes++; return { error: null }; } } },
  from(table: string) {
    const result = table === 'profiles' ? { data: { role: deletionRole } } : { data: subscriptionStatus ? [{ status: subscriptionStatus }] : [] };
    const builder: any = { select: () => builder, eq: () => builder, maybeSingle: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve), insert: async (event: any) => { audits.push(event); return { error: null }; } }; return builder;
  }
};
app.use('/api/admin/delete-users', createAdminDeleteUsersRouter((async (req: any, res: any) => {
  if (req.headers.authorization !== 'Bearer fixture-admin') { res.status(req.headers.authorization ? 403 : 401).json({ error: 'Admin access required.' }); return null; }
  return { identity: { user: { id: owner } }, serviceSupabase: deletionDb };
}) as any));

const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as any;
const origin = `http://127.0.0.1:${address.port}`;
config.appOrigin = origin; config.redirectUri = `${origin}/api/comms/oauth/callback`;
const cookie = (s = session) => `q_zoho_mail=${sealMail(s, key, 'session')}`;
const request = (path: string, init: RequestInit = {}, auth = 'fixture-staff', credentials = cookie()) => fetch(`${origin}/api/comms${path}`, { ...init, redirect: 'manual', headers: { Authorization: `Bearer ${auth}`, Cookie: credentials, ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
const payload = { to: 'visitor@example.test', cc: '', bcc: '', subject: 'Welcome', content: 'Hello, welcome to Q.', replyTo: '', attachments: [] };
const post = (value: unknown) => ({ method: 'POST', body: JSON.stringify(value) });

try {
  assert.equal((await request('/tickets/sync',post({start:1}),'fixture-user')).status,403);
  assert.equal((await request('/tickets/sync',post({start:1}),'fixture-other')).status,403);
  assert.equal((await request('/tickets/sync',post({start:-1}))).status,400);
  assert.equal((await request('/tickets/sync',post({start:1,mailbox:'scott@q-ai.online'}))).status,400);
  assert.equal((await request('/tickets/sync',post({start:1}))).status,200);
  assert(allowedMailOrigin('https://www.q-ai.online', 'https://q-ai.online'));
  assert(allowedMailOrigin('https://q-ai.online', 'https://www.q-ai.online'));
  for (const candidate of ['https://q-ai.online.attacker.test', 'https://evil.example.test', 'http://www.q-ai.online', 'https://www.q-ai.online:444', 'https://user@www.q-ai.online', 'null']) assert.equal(allowedMailOrigin(candidate, 'https://q-ai.online'), false);
  assert.equal(allowedMailOrigin('https://www.q-ai.online', 'https://preview.example.test'), false);
  const customFolder = { folderId: '20005', name: 'Customers', type: 'Inbox', path: '/Customers' };
  const actualInbox = { folderId: '20001', name: 'Inbox', type: 'Inbox', path: '/Inbox' };
  assert.equal(inboxFolder([customFolder, actualInbox]), '20001');
  assert.equal(inboxFolder([customFolder, { ...actualInbox, name: 'Boite de reception' }]), '20001');
  assert.equal(inboxFolder([customFolder, { ...actualInbox, path: undefined }]), '20001');
  assert.equal(inboxFolder([]), '');
  for (const [error, expected] of [['invalid_client', /same Self Client/], ['invalid_client_secret', /configured Client ID/], ['invalid_code', /not the short-lived/], ['invalid_grant', /new office mailbox refresh token/]] as const) {
    await assert.rejects(tokenRequest(config, { grant_type: 'refresh_token', refresh_token: 'fixture-refresh' }, (async () => new Response(JSON.stringify({ error, error_description: 'SECRET_DO_NOT_LEAK' }))) as typeof fetch), (failure: any) => expected.test(failure.message) && !failure.message.includes('SECRET_DO_NOT_LEAK'));
  }
  for (const body of [null, { error: 'UNKNOWN_SECRET_DO_NOT_LEAK' }]) await assert.rejects(tokenRequest(config, {}, (async () => new Response(JSON.stringify(body))) as typeof fetch), (failure: any) => !failure.message.includes('SECRET_DO_NOT_LEAK') && failure.message.includes('hosting settings'));
  const sealed = sealMail(session, key, 'session');
  assert.deepEqual(openMail(sealed, key, 'session'), session);
  assert.equal(openMail(sealed, key, 'state'), null);
  assert.equal(openMail(sealed.slice(0, -4) + 'AAAA', key, 'session'), null);
  assert.equal(validMailSession(session, target), false);
  assert.equal(validMailSession({ ...session, expires: 0 }, owner), false);
  const exactId = parseZohoJson('{"messageId":1709876190693100009,"content":"ID 1709876190693100009 stays in a quoted string","safe":25,"decimal":1.25}');
  assert.equal(exactId.messageId, '1709876190693100009'); assert.equal(exactId.safe, 25); assert.equal(exactId.decimal, 1.25); assert.equal(exactId.content, 'ID 1709876190693100009 stays in a quoted string');
  assert.throws(() => mailRecipients('person@example.test\r\nBcc: attacker@example.test'), /valid/);
  assert.equal(emailTemplates.length, 30); assert.equal(new Set(emailTemplates.map(t => t.id)).size, 30);
  for (const template of emailTemplates) {
    const fields = templatePlaceholders(template.subject, template.body);
    assert(fields.includes('name')); assert(fields.includes('staff_name'));
    const values = Object.fromEntries(fields.map(f => [f, f === 'name' ? 'Alex' : 'Example detail']));
    assert.equal(templatePlaceholders(fillEmailTemplate(template.subject, values), fillEmailTemplate(template.body, values)).length, 0);
  }
  assert.equal((await fetch(`${origin}/api/comms/status`)).status, 401);
  configured = false; assert.equal((await (await request('/status')).json()).configured, false); assert.equal((await request('/accounts')).status, 503); configured = true;
  assert.equal((await request('/accounts', {}, 'fixture-user')).status, 403);
  assert.equal((await request('/accounts', {}, 'fixture-other', '')).status, 200);
  assert.equal((await request('/accounts', {}, 'fixture-staff', '')).status, 200);
  const status = await (await request('/status')).json(); assert.equal(status.connected, true); assert.equal(status.mailbox, 'office@q-ai.online'); assert(!JSON.stringify(status).includes('fixture-refresh'));
  assert.equal((await request('/oauth/start', { method: 'POST' })).status, 409);
  assert.equal((await request('/disconnect', { method: 'POST', headers: { Origin: 'https://evil.example.test' } })).status, 403);
  const mailboxList = await (await request('/accounts')).json(); assert.equal(mailboxList.accounts.length, 1); assert.equal(mailboxList.accounts[0].email, 'office@q-ai.online');
  const history = await (await request(`/customers/${target}/history`)).json();
  assert.equal(history.communications.length, 3);
  assert.deepEqual(history.communications.map((item: any) => item.direction), ['inbound', 'outbound', 'outbound']);
  assert(!JSON.stringify(history).includes('PRIVATE_BODY_NOT_HISTORY'));
  assert.equal((await request(`/customers/${owner}/history`)).status, 404);
  assert.equal((await request('/customers/not-a-user/history')).status, 400);
  assert.equal((await request(`/customers/${target}/history?start=-1`)).status, 400);
  assert.equal((await request(`/customers/${target}/history`, {}, 'fixture-user')).status, 403);
  for (const path of ['/accounts/99999/folders', '/accounts/99999/messages?folder=20001', '/accounts/99999/folders/20001/messages/30001', '/accounts/99999/folders/20001/messages/30001/attachments/40001']) assert.equal((await request(path)).status, 403);
  mailboxEmail = 'personal@example.test'; assert.equal((await request('/accounts')).status, 403); mailboxEmail = 'office@q-ai.online';
  assert.equal((await request('/accounts')).status, 200);
  const folderList = await (await request('/accounts/10001/folders')).json();
  assert.equal(folderList.folders[0].unreadCount, 7);
  assert.equal(folderList.folders[1].unreadCount, 0);
  assert.equal((await request('/accounts/10001/messages?folder=20001')).status, 200);
  const inboxRequest = calls.at(-1)!.url;
  assert.equal(inboxRequest.searchParams.get('folderId'), '20001');
  assert.equal(inboxRequest.searchParams.get('sortorder'), 'false');
  assert.equal(inboxRequest.searchParams.get('status'), 'all');
  emptyView = 'extended';
  const basicPage = await (await request('/accounts/10001/messages?folder=20001')).json();
  assert.equal(basicPage.source, 'basic-folder'); assert.equal(basicPage.messages.length, 1);
  emptyView = 'all';
  const searchPage = await (await request('/accounts/10001/messages?folder=20001')).json();
  assert.equal(searchPage.source, 'folder-search'); assert.equal(searchPage.messages.length, 1);
  assert(calls.some(call => call.url.searchParams.get('searchKey') === 'in:"Inbox"' && Number(call.url.searchParams.get('receivedTime')) > Date.now() - 60000));
  const otherFolder = await (await request('/accounts/10001/messages?folder=20002')).json();
  assert.equal(otherFolder.messages.length, 0);
  assert.equal((await request('/accounts/10001/messages?folder=99999')).status, 404);
  emptyView = 'none';
  malformedMessages = true;
  assert.equal((await request('/accounts/10001/messages?folder=20001')).status, 502);
  malformedMessages = false;
  assert.equal((await request('/accounts/10001/messages?folder=20001&start=-1')).status, 400);
  assert.equal((await request('/accounts/10001/messages?search=subject%3Ahello')).status, 200);
  assert(calls.some(c => c.url.pathname.endsWith('/search') && c.url.searchParams.get('searchKey') === 'subject:hello'));
  const merged = await (await request('/accounts/10001/messages?folder=20001&inbox=true&start=31')).json();
  assert.equal(merged.source,'combined-inbox');assert.deepEqual(merged.messages.map((m:any)=>m.messageId),['701','702','703']);
  assert.deepEqual(merged.messages.map((m:any)=>m.folderId),['20007','20006','20001']);
  const mergedCall=calls.find(c=>c.url.searchParams.get('searchKey')==='in:"Inbox"::or:in:"Notification"::or:in:"Newsletter"');assert.ok(mergedCall);assert.equal(mergedCall.url.searchParams.get('start'),'31');
  const sample=[{folderId:'1',name:'Inbox',type:'Inbox',unreadCount:1},{folderId:'2',name:'Notification',type:'Inbox',unreadCount:2},{folderId:'3',name:'Newsletter',type:'Inbox',unreadCount:3},{folderId:'4',name:'Spam',type:'Spam',unreadCount:7}];
  assert.equal(combinedInboxFolders(sample).length,3);assert.deepEqual(visibleMailFolders(sample).map(f=>f.name),['Inbox','Spam']);assert.equal(visibleMailFolders(sample)[0].unreadCount,6);
  const detail = await (await request('/accounts/10001/folders/20001/messages/30001')).json(); assert.equal(detail.attachments[0].id, '40001');
  assert(detail.images['fixture-image'].startsWith('data:image/png;base64,'));
  assert.equal(detail.images['unsafe-image'], undefined);
  assert(calls.some(c => c.url.pathname.endsWith('/attachmentinfo') && c.url.searchParams.get('includeInline') === 'true'));
  const download = await request('/accounts/10001/folders/20001/messages/30001/attachments/40001'); assert.equal(download.headers.get('content-type'), 'application/octet-stream'); assert(download.headers.get('content-disposition')?.startsWith('attachment')); assert.equal(await download.text(), 'example');
  assert.equal((await request('/accounts/not-a-number/folders')).status, 400);
  assert.equal((await request('/accounts/10001/send', post({ ...payload, content: 'Hi {{name}}' }))).status, 400);
  assert.equal((await request('/accounts/10001/send', post({ ...payload, fromAddress: 'spoof@example.test' }))).status, 400);
  assert.equal((await request('/accounts/10001/send', post({ ...payload, to: 'bad\r\n@example.test' }))).status, 400);
  assert.equal((await request('/accounts/99999/send', post(payload))).status, 403);
  assert.equal((await request('/accounts/99999/attachments?name=test.txt', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from('test') })).status, 403);
  assert.equal((await request('/accounts/99999/messages/30001', { method: 'PATCH', body: JSON.stringify({ action: 'read' }) })).status, 403);
  assert.equal((await request('/accounts/10001/send', post(payload))).status, 200);
  const sendBody = JSON.parse(calls.at(-1)!.init.body as string); assert.equal(sendBody.fromAddress, 'office@q-ai.online'); assert.equal(sendBody.mailFormat, 'plaintext');
  assert.equal((await request('/accounts/10001/send', post({ ...payload, replyTo: '30001' }))).status, 200); assert.equal(calls.at(-1)!.url.pathname, '/api/accounts/10001/messages/30001'); assert.equal(JSON.parse(calls.at(-1)!.init.body as string).action, 'reply');
  const previousOrigin = config.appOrigin;
  config.appOrigin = 'https://q-ai.online';
  assert.equal((await request('/accounts/10001/send', { ...post({ ...payload, replyTo: '30001' }), headers: { Origin: 'https://www.q-ai.online' } })).status, 200);
  const callsBeforeBlockedReply = calls.length;
  assert.equal((await request('/accounts/10001/send', { ...post({ ...payload, replyTo: '30001' }), headers: { Origin: 'https://evil.example.test' } })).status, 403);
  assert.equal(calls.length, callsBeforeBlockedReply);
  config.appOrigin = previousOrigin;
  assert.equal((await request('/accounts/10001/send', post({ ...payload, draft: true }))).status, 200); assert.equal(JSON.parse(calls.at(-1)!.init.body as string).mode, 'draft');
  const upload = await request('/accounts/10001/attachments?name=example.txt', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from('example') });
  assert.equal(upload.status, 200); const uploaded = (await upload.json()).attachment;
  assert.equal((await request('/accounts/10001/send', post({ ...payload, attachments: [uploaded.proof] }))).status, 200);
  assert.equal((await request('/accounts/10001/send', post({ ...payload, attachments: [uploaded.proof.slice(0, -4) + 'AAAA'] }))).status, 400);
  assert.equal((await request('/accounts/10001/messages/30001', { method: 'PATCH', body: JSON.stringify({ action: 'move', folderId: '20002' }) })).status, 200);
  assert.equal(JSON.parse(calls.at(-1)!.init.body as string).destfolderId, '20002');
  const trashFolders = [
    { folderId: 'custom', name: 'Trash', type: 'Inbox' },
    { folderId: '20005', name: 'Deleted messages', type: 'Trash', path: '/Trash' },
  ];
  assert.equal(trashFolder(trashFolders), '20005');
  assert.equal(trashFolder([{ folderId: '20005', name: 'Deleted messages', type: 'Trash' }]), '20005');
  assert.equal(trashFolder([{ folderId: '20005', name: 'Trash', type: '' }]), '20005');
  assert.equal(trashFolder([]), '');
  assert.equal(trashFolder([{ folderId: '20001', name: 'Inbox', type: 'Inbox' }]), '');
  assert.equal((await request('/accounts/10001/messages/30001', { method: 'PATCH', body: JSON.stringify({ action: 'move', folderId: trashFolder(trashFolders) }) })).status, 200);
  assert.deepEqual(JSON.parse(calls.at(-1)!.init.body as string), { mode: 'moveMessage', messageId: ['30001'], destfolderId: '20005' });

  const bulkRequest = (body: unknown, accountId = '10001', auth = 'fixture-admin', requestOrigin?: string) => request(`/accounts/${accountId}/messages`, { method: 'PATCH', body: JSON.stringify(body), ...(requestOrigin ? { headers: { Origin: requestOrigin } } : {}) }, auth);
  const bulkIds = ['30001', '1709876190693100009'];
  for (const [action, mode] of [['read', 'markAsRead'], ['unread', 'markAsUnread'], ['archive', 'archiveMails'], ['move', 'moveMessage']]) {
    const response = await bulkRequest({ action, messageIds: bulkIds, ...(action === 'move' ? { folderId: '20005' } : {}) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, count: 2 });
    assert.equal(calls.at(-1)!.init.method, 'PUT');
    assert.deepEqual(JSON.parse(calls.at(-1)!.init.body as string), { mode, messageId: bulkIds, ...(action === 'move' ? { destfolderId: '20005' } : {}) });
  }
  assert.equal((await bulkRequest({ action: 'read', messageIds: ['30001', '30001'] })).status, 200);
  assert.deepEqual(JSON.parse(calls.at(-1)!.init.body as string).messageId, ['30001']);
  const updatesBeforeInvalid = calls.filter(call => call.url.pathname.endsWith('/updatemessage')).length;
  for (const body of [
    { action: 'read', messageIds: [] }, { action: 'read', messageIds: Array(31).fill('30001') },
    { action: 'read', messageIds: ['30001', 'bad'] }, { action: 'read', messageIds: '30001' },
    { action: 'read' }, { action: 'delete', messageIds: bulkIds },
    { action: 'move', messageIds: bulkIds }, { action: 'move', messageIds: bulkIds, folderId: 'bad' },
    { action: 'read', messageIds: bulkIds, fromAddress: 'spoof@example.test' },
  ]) assert.equal((await bulkRequest(body)).status, 400);
  assert.equal((await bulkRequest({ action: 'read', messageIds: bulkIds }, '99999')).status, 403);
  assert.equal((await bulkRequest({ action: 'read', messageIds: bulkIds }, '10001', 'fixture-user')).status, 403);
  assert.equal((await bulkRequest({ action: 'read', messageIds: bulkIds }, '10001', 'fixture-admin', 'https://evil.example.test')).status, 403);
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/updatemessage')).length, updatesBeforeInvalid);
  providerStatus = 403;
  assert.equal((await bulkRequest({ action: 'move', messageIds: bulkIds, folderId: '20005' })).status, 403);
  providerStatus = 200;

  providerStatus = 403; const denied = await request('/accounts'); assert.equal(denied.status, 403); assert(!(await denied.text()).includes('DO_NOT_LEAK')); providerStatus = 200;
  let refreshCount = 0; const expired = { ...session, tokenExpires: 0 };
  const client = new ZohoMailClient(config, expired, () => refreshCount++, fetcher);
  const tokensBefore = calls.filter(c => c.url.pathname === '/oauth/v2/token').length;
  await Promise.all([client.json('/accounts'), client.json('/accounts')]); assert.equal(refreshCount, 1); assert.equal(calls.filter(c => c.url.pathname === '/oauth/v2/token').length, tokensBefore + 1);
  const disconnected = await request('/disconnect', { method: 'POST' }); assert.equal(disconnected.status, 200); assert.equal((await disconnected.json()).shared, true); assert(disconnected.headers.getSetCookie().some(c => c.startsWith('q_zoho_mail=;') && c.includes('Max-Age=0')));
  assert.equal((await request('/accounts', {}, 'fixture-other', '')).status, 200); assert(!calls.some(c => c.url.pathname.endsWith('/revoke')));
  const deleteRequest = (id = target, confirmation = 'visitor@example.test', auth = 'fixture-admin') => fetch(`${origin}/api/admin/delete-users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) });
  assert.equal((await deleteRequest(target, 'visitor@example.test', 'fixture-staff')).status, 403);
  assert.equal((await deleteRequest(owner)).status, 409);
  assert.equal((await deleteRequest(target, 'wrong@example.test')).status, 400);
  deletionRole = 'partner_admin'; assert.equal((await deleteRequest()).status, 409); deletionRole = 'user';
  for (const state of ['APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED']) { subscriptionStatus = state; assert.equal((await deleteRequest()).status, 409); }
  subscriptionStatus = 'CANCELLED'; assert.equal((await deleteRequest()).status, 200); assert.equal(deletes, 1); assert(audits.some(a => a.action === 'admin.user.deleted'));
  console.log('PASS: shared office mailbox enforcement and Staff/Admin access, provider relay, bulk email actions and validation, drafts/replies/attachments, privacy errors, 30 templates and admin deletion guards. No live provider or database was used.');
} finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
