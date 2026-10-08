import express from 'express';
import {attachmentColumns,attachmentType,supportAttachmentLimit,cleanupSupportFiles} from '../supportAttachments.js';
import { createHash, randomBytes } from 'node:crypto';
import { asyncHandler, getAuthenticatedUser, getCanonicalAppUrl } from '../middleware.js';
import { getServiceSupabase, requireStaff } from './admin.js';
import { boundedString, isUuid, requireExactObject } from '../security.js';
import { supportCategories, supportStatuses } from '../../src/shared/support.js';
import { sendSupportEmail } from '../supportMail.js';
import { allowedMailOrigin } from '../zohoMail.js';

const hash = (token: string | Buffer) => createHash('sha256').update(token).digest('hex');
const cookieName = 'q_support_session';
const publicColumns = 'id,category,subject,message,status,created_at,updated_at';
const messageColumns = 'id,author_kind,internal,body,created_at';
type Dependencies = { db: () => any; authenticate: typeof getAuthenticatedUser; staff: typeof requireStaff; email: typeof sendSupportEmail; origin: typeof getCanonicalAppUrl };

export function createSupportRouter(deps: Dependencies) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  router.use((_req, res, next) => { const db = deps.db(); if (!db) return res.status(503).json({ error: 'Support is temporarily unavailable.' }); res.locals.db = db; next(); });
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin && !allowedMailOrigin(req.headers.origin, deps.origin())) return res.status(403).json({ error: 'Open support on Q’s configured site address.' });
    next();
  });
  function failure(res: express.Response, error: any) {
    const message = String(error?.message || '');
    if (message.includes('SUPPORT_NOT_FOUND')) return res.status(404).json({ error: 'Support request not found.' });
    if (message.includes('SUPPORT_CONFLICT')) return res.status(409).json({ error: 'This submission identifier was already used. Refresh the conversation before trying again.' });
    if (message.includes('SUPPORT_FORBIDDEN')) return res.status(403).json({ error: 'This support action is not allowed.' });
    if (message.includes('SUPPORT_INVALID')) return res.status(400).json({ error: 'Check the support request details.' });
    return res.status(503).json({ error: 'Unable to save or load support. Please try again.', code: 'SUPPORT_UNAVAILABLE' });
  }
  async function viewer(req: express.Request, res: express.Response) {
    // An explicit bearer token must validate; never silently fall back to a guest cookie.
    if (req.headers.authorization) {
      const identity = await deps.authenticate(req);
      if (!identity || identity.user.is_anonymous || !identity.user.email_confirmed_at) { res.status(401).json({ error: 'Sign in with a verified Q account.' }); return null; }
      return { userId: identity.user.id, email: identity.user.email!, requestId: null as string | null };
    }
    const cookies = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${cookieName}=`));
    const token = cookies.length === 1 ? cookies[0].slice(cookieName.length + 1) : '';
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
      const { data, error } = await res.locals.db.from('support_access').select('request_id').eq('token_hash', hash(token)).eq('kind', 'session').gt('expires_at', new Date().toISOString()).maybeSingle();
      if (!error && data) return { userId: null, email: '', requestId: data.request_id as string };
    }
    res.status(401).json({ error: 'Sign in or request a fresh email access link.' }); return null;
  }
  function owned(query: any, actor: { userId: string | null; requestId: string | null }) {
    return actor.userId ? query.eq('user_id', actor.userId) : query.eq('id', actor.requestId).is('user_id', null).eq('guest_access', true);
  }
  async function ticket(req: express.Request, res: express.Response, staff = false) {
    if (!isUuid(req.params.id)) { res.status(400).json({ error: 'Invalid support request.' }); return null; }
    const actor = staff ? null : await viewer(req, res); if (!staff && !actor) return null;
    let query = res.locals.db.from('contact_requests').select(staff ? '*' : publicColumns).eq('id', req.params.id);
    if (actor) query = owned(query, actor);
    const { data, error } = await query.maybeSingle();
    if (error) { failure(res, error); return null; }
    if (!data) { res.status(404).json({ error: 'Support request not found.' }); return null; }
    return { request: data, actor };
  }
  async function staffAccess(req: express.Request, res: express.Response) {
    const staff = await deps.staff(req, res); if (!staff) return null;
    const capability = req.method === 'GET' ? 'support.read' : 'support.write';
    if (staff.role !== 'partner_admin' && staff.permissions.length && !staff.permissions.includes(capability)) {
      res.status(403).json({ error: 'This staff support permission is required.' }); return null;
    }
    return staff;
  }
  async function accessLink(db: any, requestId: string) {
    const token = randomBytes(32).toString('base64url');
    const { error } = await db.from('support_access').insert({ request_id: requestId, token_hash: hash(token), kind: 'link', expires_at: new Date(Date.now() + 86400000).toISOString() });
    if (error) throw new Error('SUPPORT_ACCESS_UNAVAILABLE');
    return `${deps.origin()}/support#access=${token}`;
  }
  async function notify(db: any, request: any, messageId: string) {
    // A repeated message submission never sends the same notification twice.
    const claim = await db.from('support_notifications').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('message_id', messageId).eq('status', 'pending').select('message_id').maybeSingle();
    if (claim.error || !claim.data) return;
    let status = 'sent';
    try {
      const link = request.user_id ? `${deps.origin()}/app?tab=help&request=${request.id}` : await accessLink(db, request.id);
      await deps.email(request.email, link);
    } catch (error) { status = error instanceof Error && error.message === 'SUPPORT_MAIL_UNAVAILABLE' ? 'unavailable' : 'failed'; }
    await db.from('support_notifications').update({ status, updated_at: new Date().toISOString() }).eq('message_id', messageId);
  }
  async function conversation(res: express.Response, request: any, staff: boolean) {
    let messages = res.locals.db.from('support_messages').select(messageColumns).eq('request_id', request.id).order('created_at').order('id');
    if (!staff) messages = messages.eq('internal', false);
    const [messageResult, events] = await Promise.all([
      messages,
      staff ? res.locals.db.from('support_events').select('id,action,status,created_at,actor_id,assigned_to').eq('request_id', request.id).order('created_at').order('id') : Promise.resolve({ data: [], error: null })
    ]);
    if (messageResult.error || events.error) return failure(res, messageResult.error || events.error);
    let result = messageResult.data ?? [];
    if (staff && result.length) {
      const notices = await res.locals.db.from('support_notifications').select('message_id,status').in('message_id', result.map((message: any) => message.id));
      if (notices.error) return failure(res, notices.error);
      const statuses = new Map((notices.data || []).map((notice: any) => [notice.message_id, notice.status]));
      result = result.map((message: any) => ({ ...message, notification_status: statuses.get(message.id) || null }));
    }
    return res.json({ request, messages: result, events: events.data || [] });
  }

  router.post('/access', asyncHandler(async (req, res) => {
    if (!requireExactObject(req.body, ['id','email']) || !isUuid(req.body.id) || !boundedString(req.body.email, 320, true) || !/^\S+@\S+\.\S+$/.test(req.body.email)) return res.status(400).json({ error: 'Enter the request reference and email address.' });
    const email = req.body.email.trim().toLowerCase();
    const { data, error } = await res.locals.db.from('contact_requests').select('id,email').eq('id', req.body.id).eq('email', email).is('user_id', null).eq('guest_access',true).maybeSingle();
    if (error) return failure(res, error);
    // Same response for a missing request, wrong email, and provider failure.
    if (data) { try { await deps.email(email, await accessLink(res.locals.db, data.id)); } catch { /* Never disclose request existence. */ } }
    return res.status(202).json({ success: true, message: 'If those details match a signed-out request, an access link will be emailed. If it does not arrive, contact office@q-ai.online.' });
  }));
  router.post('/access/exchange', asyncHandler(async (req, res) => {
    if (!requireExactObject(req.body, ['token']) || typeof req.body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(req.body.token)) return res.status(400).json({ error: 'Invalid access link.' });
    const session = randomBytes(32).toString('base64url');
    const { data, error } = await res.locals.db.rpc('exchange_support_access', { p_link_hash: hash(req.body.token), p_session_hash: hash(session) });
    if (error) return failure(res, error);
    if (!data) return res.status(401).json({ error: 'This link has expired or was already used. Request a fresh access link.' });
    res.cookie(cookieName, session, { httpOnly: true, sameSite: 'strict', secure: new URL(deps.origin()).protocol === 'https:', path: '/api/support', maxAge: Math.max(0,Date.parse(data.expiresAt)-Date.now()) });
    return res.json({ requestId: data.requestId });
  }));
  router.post('/access/logout', asyncHandler(async (req, res) => {
    const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
    if (cookie) {
      const token = cookie.slice(cookieName.length+1);
      const { error } = await res.locals.db.from('support_access').delete().eq('token_hash',hash(token)).eq('kind','session');
      if (error) return failure(res,error);
    }
    res.clearCookie(cookieName, { path: '/api/support' }); return res.json({ success: true });
  }));
  router.get('/requests', asyncHandler(async (req, res) => {
    const actor = await viewer(req, res); if (!actor) return;
    const { data, error } = await owned(res.locals.db.from('contact_requests').select(publicColumns), actor).order('updated_at', { ascending: false }).limit(200);
    if (error) return failure(res, error); return res.json(data || []);
  }));
  router.post('/requests', asyncHandler(async (req, res) => {
    const actor = await viewer(req, res); if (!actor) return;
    if (!actor.userId) return res.status(403).json({ error: 'Sign in to create an account support request.' });
    if (!requireExactObject(req.body, ['id','name','category','subject','message'])) return res.status(400).json({ error: 'Invalid request details.' });
    const subject = boundedString(req.body.subject, 160, true), body = boundedString(req.body.message, 5000, true), name = boundedString(req.body.name, 120);
    if (!requireExactObject(req.body, ['id','name','category','subject','message']) || !isUuid(req.body.id) || !subject || subject.length < 3 || !body || body.length < 10 || name === null || !supportCategories.includes(req.body.category)) return res.status(400).json({ error: 'Choose a topic, a subject of 3–160 characters and a message of 10–5,000 characters.' });
    const existing = await res.locals.db.from('contact_requests').select('id').eq('user_id', actor.userId).gt('created_at', new Date(Date.now() - 300000).toISOString()).neq('id', req.body.id).limit(1);
    if (existing.error) return failure(res, existing.error);
    if (existing.data?.length) return res.status(429).json({ error: 'Please wait five minutes before creating another request. You can reply to an existing request now.' });
    const { data, error } = await res.locals.db.rpc('create_support_request', { p_id: req.body.id, p_user_id: actor.userId, p_email: actor.email, p_name: name || null, p_category: req.body.category, p_subject: subject, p_body: body });
    if (error) return failure(res, error);
    return res.status(201).json({ id: data.id });
  }));
  router.get('/requests/:id', asyncHandler(async (req, res) => { const found = await ticket(req, res); if (found) return conversation(res, found.request, false); }));
  router.post('/requests/:id/messages', asyncHandler(async (req, res) => {
    const found = await ticket(req, res); if (!found) return;
    if (!requireExactObject(req.body,['id','body'])) return res.status(400).json({ error: 'Invalid reply details.' });
    const body = boundedString(req.body.body, 5000, true);
    if (!requireExactObject(req.body, ['id','body']) || !isUuid(req.body.id) || !body) return res.status(400).json({ error: 'Enter a reply of 1–5,000 characters.' });
    const { error } = await res.locals.db.rpc('change_support_request', { p_request_id: found.request.id, p_actor_id: found.actor!.userId, p_staff: false, p_action: 'reply', p_message_id: req.body.id, p_body: body });
    if (error) return failure(res, error); return res.status(201).json({ success: true });
  }));
  router.patch('/requests/:id', asyncHandler(async (req, res) => {
    const found = await ticket(req, res); if (!found) return;
    if (!requireExactObject(req.body, ['status']) || !['closed','in_progress'].includes(req.body.status)) return res.status(400).json({ error: 'Choose close or reopen.' });
    const { error } = await res.locals.db.rpc('change_support_request', { p_request_id: found.request.id, p_actor_id: found.actor!.userId, p_staff: false, p_action: 'status', p_status: req.body.status });
    if (error) return failure(res, error); return res.json({ success: true });
  }));
  router.use('/staff', asyncHandler(async (req, res, next) => { const staff = await staffAccess(req, res); if (staff) { res.locals.staff = staff; next(); } }));
  router.get('/staff/assignees', asyncHandler(async (_req, res) => {
    const { data, error } = await res.locals.db.from('profiles').select('id,role,staff_permissions,preferred_name').in('role', ['staff','partner_admin']);
    if (error) return failure(res, error);
    // No private profile context or personal mailbox information is returned.
    return res.json((data || []).filter((profile: any) => profile.role === 'partner_admin' || !profile.staff_permissions?.length || profile.staff_permissions.includes('support.read')).map((profile: any) => ({ id: profile.id, label: profile.preferred_name?.trim() || `${profile.role === 'partner_admin' ? 'Admin' : 'Staff'} ${profile.id.slice(0,8)}` })));
  }));
  router.get('/staff/requests', asyncHandler(async (req, res) => {
    const status = String(req.query.status || ''), category = String(req.query.category || ''), assigned = String(req.query.assigned || '');
    if ((status && !supportStatuses.includes(status as any)) || (category && !supportCategories.includes(category as any)) || !['','me','unassigned'].includes(assigned) || !['true','false'].includes(String(req.query.archived || 'false'))) return res.status(400).json({ error: 'Invalid support filters.' });
    let query = res.locals.db.from('contact_requests').select('*');
    query = req.query.archived === 'true' ? query.not('archived_at','is',null) : query.is('archived_at',null);
    if (status) query = query.eq('status',status); if (category) query = query.eq('category',category);
    if (assigned === 'me') query = query.eq('assigned_to',res.locals.staff.identity.user.id); if (assigned === 'unassigned') query = query.is('assigned_to',null);
    const { data, error } = await query.order('updated_at',{ ascending: false }).limit(200);
    if (error) return failure(res,error); return res.json(data || []);
  }));
  router.get('/staff/requests/:id', asyncHandler(async (req, res) => { const found = await ticket(req, res, true); if (found) return conversation(res, found.request, true); }));
  router.post('/staff/requests/:id/messages', asyncHandler(async (req, res) => {
    const found = await ticket(req,res,true); if (!found) return;
    if (!requireExactObject(req.body,['id','body','internal'])) return res.status(400).json({ error: 'Invalid reply details.' });
    const body = boundedString(req.body.body,5000,true);
    if (!requireExactObject(req.body,['id','body','internal']) || !isUuid(req.body.id) || !body || typeof req.body.internal !== 'boolean') return res.status(400).json({ error: 'Enter a reply or internal note of 1–5,000 characters.' });
    const { data, error } = await res.locals.db.rpc('change_support_request', { p_request_id: found.request.id, p_actor_id: res.locals.staff.identity.user.id, p_staff: true, p_action: req.body.internal ? 'note' : 'reply', p_message_id: req.body.id, p_body: body });
    if (error) return failure(res,error);
    if (!req.body.internal) await notify(res.locals.db,data,req.body.id);
    return res.status(201).json({ success: true });
  }));
  router.patch('/staff/requests/:id', asyncHandler(async (req, res) => {
    const found = await ticket(req,res,true); if (!found) return;
    if (!requireExactObject(req.body,['action','status','assignedTo','dueAt','priority']) || !['status','assignment','archive','restore','due','priority'].includes(req.body.action) ||
      (req.body.action === 'status' && !supportStatuses.includes(req.body.status)) ||
      (req.body.action === 'assignment' && req.body.assignedTo !== null && !isUuid(req.body.assignedTo))) return res.status(400).json({ error: 'Choose a valid support action.' });
    if (req.body.action === 'due' || req.body.action === 'priority') {
      const date=req.body.dueAt;
      if ((req.body.action==='due' && date!==null && (typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(date)||!Number.isFinite(Date.parse(date)))) || (req.body.action==='priority'&&!['low','normal','high','urgent'].includes(req.body.priority))) return res.status(400).json({error:'Choose a valid due date or priority.'});
      const {error}=await res.locals.db.rpc('schedule_support_ticket',{p_request:found.request.id,p_actor:res.locals.staff.identity.user.id,p_action:req.body.action,p_due:date?new Date(date).toISOString():null,p_priority:req.body.priority||null});
      if(error)return failure(res,error);return res.json({success:true});
    }
    if (req.body.action === 'assignment' && req.body.assignedTo) {
      const assignee = await res.locals.db.from('profiles').select('role,staff_permissions').eq('id',req.body.assignedTo).maybeSingle();
      if (assignee.error) return failure(res,assignee.error);
      if (!assignee.data || !['staff','partner_admin'].includes(assignee.data.role) || (assignee.data.role !== 'partner_admin' && assignee.data.staff_permissions?.length && !assignee.data.staff_permissions.includes('support.read'))) return res.status(400).json({ error: 'Choose a staff member with support access.' });
    }
    const { error } = await res.locals.db.rpc('change_support_request', { p_request_id: found.request.id, p_actor_id: res.locals.staff.identity.user.id, p_staff: true, p_action: req.body.action, p_status: req.body.status || null, p_assignee: req.body.assignedTo || null });
    if (error) return failure(res,error); return res.json({ success: true });
  }));
  router.post('/staff/requests/:id/notifications/:message/retry', asyncHandler(async (req,res) => {
    const found = await ticket(req,res,true); if (!found) return;
    if (!isUuid(req.params.message) || !requireExactObject(req.body,['checkedSent']) || req.body.checkedSent !== true) return res.status(400).json({ error: 'Check the office Sent mailbox before retrying the notification.' });
    const message = await res.locals.db.from('support_messages').select('id').eq('id',req.params.message).eq('request_id',found.request.id).eq('author_kind','staff').eq('internal',false).maybeSingle();
    if (message.error) return failure(res,message.error);
    if (!message.data) return res.status(404).json({ error: 'Notification not found.' });
    const notice = await res.locals.db.from('support_notifications').select('status,updated_at').eq('message_id',req.params.message).maybeSingle();
    if (notice.error) return failure(res,notice.error);
    const stale = notice.data?.status === 'sending' && Date.parse(notice.data.updated_at) < Date.now()-300000;
    if (!notice.data || notice.data.status === 'sent' || (notice.data.status === 'sending' && !stale)) return res.status(409).json({ error: 'This notification was already sent or is still being processed.' });
    const reset = await res.locals.db.from('support_notifications').update({ status:'pending', updated_at:new Date().toISOString() }).eq('message_id',req.params.message).eq('status',notice.data.status).eq('updated_at',notice.data.updated_at).select('message_id').maybeSingle();
    if (reset.error) return failure(res,reset.error);
    if (!reset.data) return res.status(409).json({ error: 'Notification state changed. Refresh the conversation.' });
    await notify(res.locals.db,found.request,req.params.message);
    return res.json({ success:true });
  }));
  function attachmentRoutes(prefix:string,staff:boolean){
    const authorised=asyncHandler(async(req,res,next)=>{const found=await ticket(req,res,staff);if(found){res.locals.attachmentTicket=found;next();}});
    router.get(`${prefix}/:id/attachments`,authorised,asyncHandler(async(req,res)=>{
      let query=res.locals.db.from('support_attachments').select(attachmentColumns+',author_id,author_kind').eq('request_id',req.params.id).eq('status','ready');if(!staff)query=query.eq('internal',false);
      const{data,error}=await query.order('created_at');if(error)return failure(res,error);res.json((data||[]).map(({author_id,author_kind,...file}:any)=>({...file,canRemove:staff||(author_kind==='user'&&author_id===res.locals.attachmentTicket.actor.userId)})));
    }));
    router.post(`${prefix}/:id/attachments`,authorised,express.raw({type:'application/octet-stream',limit:supportAttachmentLimit}),asyncHandler(async(req,res)=>{
      const bytes=req.body,id=req.headers['x-attachment-id'];let name='';try{name=decodeURIComponent(String(req.headers['x-file-name']||''));}catch{}
      if(!isUuid(id)||!Buffer.isBuffer(bytes)||!name||name.length>160||/[\x00-\x1f\x7f/\\]/.test(name))return res.status(400).json({error:'Choose a file with a valid name.'});
      const mime=attachmentType(bytes);if(!mime)return res.status(400).json({error:'Choose a PNG, JPEG, PDF or plain-text file up to 2 MB.'});
      const internal=req.headers['x-internal-file']==='true';if(internal&&!staff)return res.status(403).json({error:'Only staff can upload an internal file.'});
      const found=res.locals.attachmentTicket,actor=staff?res.locals.staff.identity.user.id:found.actor.userId;
      const reserved=await res.locals.db.rpc('reserve_support_attachment',{p_id:id,p_request:req.params.id,p_author:actor,p_staff:staff,p_internal:internal,p_name:name,p_mime:mime,p_size:bytes.length,p_hash:hash(bytes)});
      if(reserved.error){if(String(reserved.error.message).includes('ATTACHMENT_LIMIT'))return res.status(409).json({error:'This request already has 10 files. Remove an unneeded file before uploading another.'});return failure(res,reserved.error);}
      const item=reserved.data;if(item.status==='ready')return res.status(201).json({id:item.id});
      const storage=res.locals.db.storage.from('q-support-private');const uploaded=await storage.upload(item.object_path,bytes,{contentType:mime,upsert:false});
      if(uploaded.error){
        // A lost response may have left the exact object saved. Verify before retrying.
        const previous=await storage.download(item.object_path);if(previous.error||!previous.data||hash(Buffer.from(await previous.data.arrayBuffer()))!==item.sha256)return res.status(503).json({error:'File upload failed. Keep the selected file and retry.'});
      }
      const ready=await res.locals.db.from('support_attachments').update({status:'ready'}).eq('id',id).eq('request_id',req.params.id).select('id').maybeSingle();if(ready.error||!ready.data){const exists=await res.locals.db.from('support_attachments').select('id').eq('id',id).maybeSingle();if(!exists.data){await storage.remove([item.object_path]);await res.locals.db.from('support_storage_cleanup').upsert({object_path:item.object_path});}return res.status(503).json({error:'File was transferred but could not be confirmed. Retry with the same file.'});}
      await res.locals.db.from('contact_requests').update({updated_at:new Date().toISOString()}).eq('id',req.params.id);
      return res.status(201).json({id:item.id});
    }));
    router.get(`${prefix}/:id/attachments/:attachment`,authorised,asyncHandler(async(req,res)=>{
      if(!isUuid(req.params.attachment))return res.status(400).json({error:'Invalid file.'});let query=res.locals.db.from('support_attachments').select('*').eq('id',req.params.attachment).eq('request_id',req.params.id).eq('status','ready');if(!staff)query=query.eq('internal',false);
      const{data,error}=await query.maybeSingle();if(error)return failure(res,error);if(!data)return res.status(404).json({error:'File not found.'});
      const file=await res.locals.db.storage.from('q-support-private').download(data.object_path);if(file.error||!file.data)return res.status(503).json({error:'File download is temporarily unavailable.'});
      res.setHeader('Content-Type','application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',`attachment; filename="support-file"; filename*=UTF-8''${encodeURIComponent(data.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);res.send(Buffer.from(await file.data.arrayBuffer()));
    }));
    router.delete(`${prefix}/:id/attachments/:attachment`,authorised,asyncHandler(async(req,res)=>{
      if(!isUuid(req.params.attachment))return res.status(400).json({error:'Invalid file.'});let query=res.locals.db.from('support_attachments').delete().eq('id',req.params.attachment).eq('request_id',req.params.id);if(!staff){query=query.eq('author_kind','user');query=(res.locals.attachmentTicket.actor.userId?query.eq('author_id',res.locals.attachmentTicket.actor.userId):query.is('author_id',null)).eq('internal',false);}
      const{data,error}=await query.select('id');if(error)return failure(res,error);if(!data?.length)return res.status(404).json({error:'File not found or removal is not permitted.'});let cleanupPending=false;try{await cleanupSupportFiles(res.locals.db);}catch{cleanupPending=true;}res.json({success:true,cleanupPending});
    }));
  }
  attachmentRoutes('/requests',false);attachmentRoutes('/staff/requests',true);
  router.post('/staff/attachments/cleanup',asyncHandler(async(_req,res)=>{try{res.json({removed:await cleanupSupportFiles(res.locals.db)});}catch{return res.status(503).json({error:'File cleanup failed. It can be retried safely.'});}}));
  router.use((err:any,_req:express.Request,res:express.Response,next:express.NextFunction)=>{if(err?.type==='entity.too.large')return res.status(413).json({error:'Choose a file up to 2 MB.'});next(err);});
  return router;
}
export const supportRouter = createSupportRouter({ db: getServiceSupabase, authenticate: getAuthenticatedUser, staff: requireStaff, email: sendSupportEmail, origin: getCanonicalAppUrl });
