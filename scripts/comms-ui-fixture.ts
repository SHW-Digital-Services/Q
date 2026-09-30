// Isolated visual QA server. It uses only invented data and cannot contact Zoho
// or Supabase. Never mount this script in the production application.
import express from 'express';
import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';

const temporary = await mkdtemp(join(tmpdir(), 'q-comms-qa-'));
const app = express(); app.use(express.json());
const tokenService = `export const getSupabaseClient = () => ({ auth: { getSession: async () => ({data:{session:{access_token: new URLSearchParams(window.location.search).get('role') === 'staff' ? 'fixture-staff' : 'fixture-admin'}}}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) } });`;
await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import CommsPortal from './src/components/CommsPortal'; import {AdminPanel} from './src/components/AdminPanel'; const path=window.location.pathname; createRoot(document.getElementById('root')).render(path==='/crm'||path==='/crm/admin' ? <AdminPanel adminMode={path==='/crm/admin'} enabled={false} onToggle={()=>{}} onClose={()=>{window.location.href='/crm'}} onPreview={async()=>{}} onSignOut={async()=>{}}/> : <CommsPortal onSignOut={async()=>{}}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: join(temporary, 'fixture.js'), format: 'esm', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolated-auth', setup(builder) { builder.onLoad({ filter: /[\\/]services[\\/]supabase\.ts$/ }, () => ({ contents: tokenService, loader: 'ts' })); } }] });
const assets = await readdir('dist/assets'); const css = assets.find(name => /^index-.*\.css$/.test(name));
app.get('/fixture.js', (_req, res) => res.sendFile(join(temporary, 'fixture.js')));
app.get('/fixture.css', (_req, res) => res.sendFile(resolve('dist/assets', css!)));
const person = { id: '00000000-0000-4000-8000-000000000002', email: 'visitor@example.test', name: 'Example visitor', role: 'user', signupAt: new Date().toISOString(), lastLoginAt: null, emailConfirmedAt: null, bannedUntil: null, subscription: null };
app.use('/api/v1/admin', (req, res) => {
  if (req.method !== 'GET') return res.status(501).json({ error: 'Visual QA does not perform admin mutations.' });
  if (req.path === '/me') return res.json({ role: req.headers.authorization === 'Bearer fixture-staff' ? 'staff' : 'partner_admin' });
  if (req.path === '/crm/users') return res.json({ users: [person], metrics: { users: 1, confirmed: 0, activeSubscriptions: 0, signedIn: 0 } });
  if (req.path.startsWith('/crm/users/')) return res.json({ identity: person, profile: { role: 'user', preferred_name: 'Example visitor' }, subscription: null, notes: [], tasks: [], payments: [], entitlements: [], activities: [], communications: [], referralCredits: [], peerKnowledgeContributions: [] });
  if (req.path === '/brevo-webhooks/dashboard') return res.json({ total: 2, awaitingReview: 2, reviewed: 0, today: 2, updatedAt: new Date().toISOString() });
  if (req.path === '/brevo-webhooks/endpoints') return res.json({ endpoints: [] });
  if (req.path === '/brevo-webhooks/events') { const events = [{ id: '00000000-0000-4000-8000-000000000011', endpoint_id: 'fixture', event_type: 'delivered', email: 'visitor@example.test', status: 'received', received_at: new Date().toISOString() }, { id: '00000000-0000-4000-8000-000000000012', endpoint_id: 'fixture', event_type: 'opened', email: 'visitor@example.test', status: 'received', received_at: new Date().toISOString() }].filter(event => !req.query.eventType || event.event_type === req.query.eventType); return res.json({ events, total: events.length, hasMore: false }); }
  if (req.path === '/help-videos') return res.json({ videos: [] });
  if (req.path === '/content') return res.json([{ id: 'fixture-news', title: req.query.archived === 'true' ? 'Archived Q news example' : 'Published Q news example', slug: 'fixture-news', contentType: 'news', status: req.query.archived === 'true' ? 'archived' : 'published', summary: 'A news item used only for local validation.', body: 'Example news body for local validation.', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString() }]);
  return res.json([]);
});
app.use('/api/comms', (req, res) => {
  if (req.path === '/status') return res.json({ configured: !req.headers.authorization?.includes('setup'), connected: true, mailUrl: 'https://mail.zoho.eu' });
  if (req.path === '/accounts') return res.json({ accounts: [{ accountId: '10001', email: 'office@q-ai.online', name: 'Q support' }] });
  if (req.path.endsWith('/folders')) return res.json({ folders: [{ folderId: '20001', name: 'Inbox', type: 'Inbox' }, { folderId: '20002', name: 'Sent', type: 'Sent' }, { folderId: '20003', name: 'Drafts', type: 'Drafts' }, { folderId: '20004', name: 'Archive', type: 'Archive' }] });
  if (req.path === '/accounts/10001/messages') return res.json({ messages: [{ messageId: '30001', folderId: '20001', subject: 'Help getting started', from: 'visitor@example.test', to: 'office@q-ai.online', receivedAt: String(Date.now()), unread: true, hasAttachment: true }], hasMore: false });
  if (req.path.endsWith('/messages/30001') && req.method === 'GET') return res.json({ content: '<p>Hello Q team,</p><p>Could you help me get started?</p><p><strong>Thank you.</strong></p><img src="https://tracking.example.test/pixel" onerror="alert(1)"><script>window.BAD_MAIL=true</script><style>body{display:none}</style><form action="https://bad.example.test"><input name="password"></form>', attachments: [{ id: '40001', name: 'example.txt', size: 7 }] });
  return res.json({ success: true });
});
app.get('*', (_req, res) => res.type('html').send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Q Communications · Local QA</title><link rel="stylesheet" href="/fixture.css"></head><body style="background:#020617"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>'));
const server = app.listen(3107, '127.0.0.1', () => console.log('Isolated UI fixture: http://127.0.0.1:3107/crm/comms (invented data only)'));
const close = () => server.close(async () => {
  const target = resolve(temporary);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('q-comms-qa-')) throw new Error('Unexpected fixture cleanup path.');
  await rm(target, { recursive: true, force: true }); process.exit(0);
});
process.once('SIGINT', close); process.once('SIGTERM', close);
