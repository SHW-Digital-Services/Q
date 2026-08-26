import express from 'express';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, asyncHandler } from '../middleware.js';
import { buildAnalyticsExport } from '../analyticsEngine.js';
import { getPayPalAccessToken, getPaypalBaseUrl } from './billing.js';

export const adminRouter = express.Router();

adminRouter.get('/site-settings/launch', asyncHandler(async (_req, res) => {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.json({ enabled: false });
  const { data } = await serviceSupabase.from('site_settings').select('value').eq('key', 'launch_override').maybeSingle();
  return res.json({ enabled: data?.value === true });
}));

function getServiceSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

interface PasswordResetRequest {
  id: string;
  email: string;
  message: string | null;
  createdAt: string;
  status: 'pending' | 'reset' | 'failed';
}

async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPaypalBaseUrl()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.details?.[0]?.description || `PayPal request failed (${response.status}).`);
  return data;
}

async function syncProductToPayPal(serviceSupabase: any, product: any) {
  try {
    let paypalProductId = product.paypal_product_id;
    if (!paypalProductId) {
      const remoteProduct = await paypalRequest('/v1/catalogs/products', { method: 'POST', body: JSON.stringify({ name: product.name, description: product.description || product.name, type: 'SERVICE', category: 'SOFTWARE' }) });
      paypalProductId = remoteProduct.id;
    } else {
      await paypalRequest(`/v1/catalogs/products/${encodeURIComponent(paypalProductId)}`, { method: 'PATCH', body: JSON.stringify([{ op: 'replace', path: '/name', value: product.name }, { op: 'replace', path: '/description', value: product.description || product.name }]) });
    }
    let paypalPlanId = product.paypal_plan_id;
    if (product.billing_interval !== 'one_time') {
      const price = (product.price_minor / 100).toFixed(2);
      if (!paypalPlanId) {
        const remotePlan = await paypalRequest('/v1/billing/plans', { method: 'POST', body: JSON.stringify({ product_id: paypalProductId, name: product.name, description: product.description || product.name, status: product.active ? 'ACTIVE' : 'INACTIVE', billing_cycles: [{ frequency: { interval_unit: product.billing_interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: price, currency_code: product.currency } } }], payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 } }) });
        paypalPlanId = remotePlan.id;
      } else {
        await paypalRequest(`/v1/billing/plans/${encodeURIComponent(paypalPlanId)}`, { method: 'PATCH', body: JSON.stringify([{ op: 'replace', path: '/name', value: product.name }, { op: 'replace', path: '/description', value: product.description || product.name }]) });
        await paypalRequest(`/v1/billing/plans/${encodeURIComponent(paypalPlanId)}/update-pricing-schemes`, { method: 'POST', body: JSON.stringify({ pricing_schemes: [{ billing_cycle_sequence: 1, pricing_scheme: { fixed_price: { value: price, currency_code: product.currency } } }] }) });
      }
    }
    const { data, error } = await serviceSupabase.from('crm_products').update({ paypal_product_id: paypalProductId, paypal_plan_id: paypalPlanId, paypal_sync_status: 'synced', paypal_last_synced_at: new Date().toISOString() }).eq('id', product.id).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    await serviceSupabase.from('crm_products').update({ paypal_sync_status: 'error' }).eq('id', product.id);
    throw error;
  }
}

function mapPasswordResetRequest(row: any): PasswordResetRequest {
  return {
    id: row.id,
    email: row.email,
    message: row.message ?? null,
    createdAt: row.created_at,
    status: row.status
  };
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(16);
  let password = '';
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }
  return password;
}

async function requireAdmin(req: express.Request, res: express.Response) {
  try {
    const identity = await getAuthenticatedUser(req);
    if (!identity) {
      res.status(401).json({ error: 'Access denied: Authentication required. Please sign in.' });
      return null;
    }
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) {
      res.status(503).json({ error: 'Supabase admin access is not configured. Please set SUPABASE_SERVICE_ROLE_KEY in environment variables.' });
      return null;
    }

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', identity.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Admin] Profile role lookup failed:', profileError);
      res.status(500).json({ error: 'Admin role check failed.' });
      return null;
    }

    if (profile?.role !== 'partner_admin') {
      res.status(403).json({ error: 'Access denied: Admin role required.' });
      return null;
    }

    return { identity, serviceSupabase };
  } catch (err: any) {
    console.error('[Admin] Auth verification failed:', err);
    res.status(401).json({ error: 'Authentication check failed.' });
    return null;
  }
}

async function requireStaff(req: express.Request, res: express.Response) {
  try {
    const identity = await getAuthenticatedUser(req);
    if (!identity) { res.status(401).json({ error: 'Authentication required.' }); return null; }
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) { res.status(503).json({ error: 'Supabase staff access is not configured.' }); return null; }
    const { data: profile, error } = await serviceSupabase.from('profiles').select('role').eq('id', identity.user.id).maybeSingle();
    if (error) { res.status(500).json({ error: 'Staff role check failed.' }); return null; }
    if (!['staff', 'partner_admin'].includes(profile?.role)) { res.status(403).json({ error: 'Staff access required.' }); return null; }
    return { identity, serviceSupabase, role: profile.role as 'staff' | 'partner_admin' };
  } catch { res.status(401).json({ error: 'Authentication check failed.' }); return null; }
}

adminRouter.get('/me', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res);
  if (!adminCtx) return;

  return res.json({
    success: true,
    user: {
      id: adminCtx.identity.user.id,
      email: adminCtx.identity.user.email
    },
    role: adminCtx.role
  });
}));

adminRouter.patch('/site-settings/launch', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean.' });
  const { error } = await adminCtx.serviceSupabase.from('site_settings').upsert({ key: 'launch_override', value: req.body.enabled, updated_by: adminCtx.identity.user.id, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ enabled: req.body.enabled });
}));

adminRouter.get('/staff', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const [{ data: profiles, error }, { data: usersData, error: usersError }] = await Promise.all([
    adminCtx.serviceSupabase.from('profiles').select('id, role, preferred_name, created_at').in('role', ['staff', 'partner_admin']).order('created_at'),
    adminCtx.serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);
  if (error || usersError) return res.status(500).json({ error: error?.message || usersError?.message || 'Unable to load staff.' });
  const usersById = new Map((usersData?.users ?? []).map((user: any) => [user.id, user]));
  return res.json((profiles ?? []).map((profile: any) => ({ ...profile, email: (usersById.get(profile.id) as any)?.email ?? '' })));
}));

adminRouter.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const role = req.body?.role;
  if (!['user', 'staff', 'partner_admin'].includes(role)) return res.status(400).json({ error: 'Role must be user, staff, or partner_admin.' });
  const targetId = req.params.id;
  const { data: current, error: currentError } = await adminCtx.serviceSupabase.from('profiles').select('id, role').eq('id', targetId).maybeSingle();
  if (currentError || !current) return res.status(404).json({ error: 'User profile not found.' });
  if (targetId === adminCtx.identity.user.id && role !== 'partner_admin') return res.status(400).json({ error: 'You cannot remove your own Admin access.' });
  if (current.role === 'partner_admin' && role !== 'partner_admin') {
    const { count, error: countError } = await adminCtx.serviceSupabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'partner_admin');
    if (countError) return res.status(500).json({ error: countError.message });
    if ((count ?? 0) <= 1) return res.status(400).json({ error: 'The final Admin account cannot be demoted.' });
  }
  const { data, error } = await adminCtx.serviceSupabase.from('profiles').update({ role }).eq('id', targetId).select('id, role, preferred_name').single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, targetId, adminCtx.identity.user.id, 'role_changed', `Account role changed from ${current.role} to ${role}`, { previousRole: current.role, role });
  return res.json(data);
}));

adminRouter.get('/crm/users', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res);
  if (!adminCtx) return;

  const { serviceSupabase } = adminCtx;
  const requestedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const perPage = 100;

  const [{ data: authData, error: authError }, { data: profiles, error: profileError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    serviceSupabase.auth.admin.listUsers({ page, perPage }),
    serviceSupabase.from('profiles').select('id, role, preferred_name, created_at, updated_at'),
    serviceSupabase.from('subscriptions').select('user_id, paypal_subscription_id, paypal_plan_id, status, current_period_end, created_at, updated_at')
  ]);

  if (authError || profileError || subscriptionError) {
    const error = authError ?? profileError ?? subscriptionError;
    console.error('[Admin CRM] Failed to load customers:', error);
    return res.status(500).json({ error: error?.message || 'Unable to load CRM customers.' });
  }

  const profilesByUser = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  const subscriptionsByUser = new Map((subscriptions ?? []).map((subscription: any) => [subscription.user_id, subscription]));
  const users = (authData?.users ?? []).map((user: any) => {
    const profile: any = profilesByUser.get(user.id);
    const subscription: any = subscriptionsByUser.get(user.id);
    return {
      id: user.id,
      email: user.email ?? '',
      name: profile?.preferred_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
      role: profile?.role ?? 'user',
      signupAt: user.created_at,
      lastLoginAt: user.last_sign_in_at ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      bannedUntil: user.banned_until ?? null,
      subscription: subscription ? {
        status: subscription.status,
        planId: subscription.paypal_plan_id,
        providerId: subscription.paypal_subscription_id,
        currentPeriodEnd: subscription.current_period_end,
        updatedAt: subscription.updated_at
      } : null
    };
  });

  return res.json({
    users,
    page,
    total: users.length,
    metrics: {
      users: users.length,
      confirmed: users.filter((user: any) => Boolean(user.emailConfirmedAt)).length,
      activeSubscriptions: users.filter((user: any) => user.subscription?.status === 'ACTIVE').length,
      signedIn: users.filter((user: any) => Boolean(user.lastLoginAt)).length
    }
  });
}));

adminRouter.post('/crm/users', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res); if (!staffCtx) return;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const requestedRole = req.body?.role;
  const role = staffCtx.role === 'partner_admin' && ['user', 'staff', 'partner_admin'].includes(requestedRole) ? requestedRole : 'user';
  const directCreate = req.body?.sendInvite === false;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email address is required.' });
  if (directCreate && staffCtx.role !== 'partner_admin') return res.status(403).json({ error: 'Only Admins can create accounts without an invitation.' });
  const redirectTo = `${(process.env.APP_URL || 'https://www.q-ai.online').replace(/\/+$/, '')}/app`;
  const temporaryPassword = directCreate ? generateTemporaryPassword() : undefined;
  const authResult = directCreate
    ? await staffCtx.serviceSupabase.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true, user_metadata: { name: name || email.split('@')[0], created_by_q_crm: true, must_change_password: true } })
    : await staffCtx.serviceSupabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name: name || email.split('@')[0], invited_by_q_crm: true } });
  if (authResult.error || !authResult.data?.user) return res.status(400).json({ error: authResult.error?.message || 'Unable to create the user account.' });
  const { error: profileError } = await staffCtx.serviceSupabase.from('profiles').upsert({ id: authResult.data.user.id, preferred_name: name || null, role, crm_status: 'customer' }, { onConflict: 'id' });
  if (profileError) return res.status(500).json({ error: `Invitation sent, but the CRM profile could not be prepared: ${profileError.message}` });
  await recordCrmActivity(staffCtx.serviceSupabase, authResult.data.user.id, staffCtx.identity.user.id, directCreate ? 'user_created' : 'user_invited', directCreate ? `Account created directly as ${role}` : `User invited as ${role}`, { email, role });
  return res.status(201).json({ id: authResult.data.user.id, email, name, role, invited: !directCreate, temporaryPassword });
}));

async function recordCrmActivity(serviceSupabase: any, userId: string, actorId: string, activityType: string, summary: string, metadata: Record<string, unknown> = {}) {
  await serviceSupabase.from('crm_activities').insert({ user_id: userId, actor_id: actorId, activity_type: activityType, summary, metadata });
}

adminRouter.get('/crm/users/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res);
  if (!adminCtx) return;
  const { serviceSupabase } = adminCtx;
  const userId = req.params.id;
  const [{ data: authData, error: authError }, profileResult, subscriptionResult, notesResult, tasksResult, paymentsResult, entitlementsResult, activitiesResult, referralCreditsResult] = await Promise.all([
    serviceSupabase.auth.admin.getUserById(userId),
    serviceSupabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    serviceSupabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    serviceSupabase.from('crm_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    serviceSupabase.from('crm_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    serviceSupabase.from('crm_payments').select('*').eq('user_id', userId).order('occurred_at', { ascending: false }),
    serviceSupabase.from('crm_entitlements').select('*, crm_products(name, price_minor, currency, billing_interval)').eq('user_id', userId).order('created_at', { ascending: false }),
    adminCtx.role === 'partner_admin'
      ? serviceSupabase.from('crm_activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    serviceSupabase.from('referral_credits').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  ]);
  if (authError || !authData?.user) return res.status(404).json({ error: 'Customer not found.' });
  const databaseError = [profileResult, subscriptionResult, notesResult, tasksResult, paymentsResult, entitlementsResult, activitiesResult, referralCreditsResult].find((result: any) => result.error)?.error;
  if (databaseError) return res.status(500).json({ error: databaseError.message });
  const user = authData.user;
  return res.json({
    identity: { id: user.id, email: user.email, phone: user.phone, signupAt: user.created_at, lastLoginAt: user.last_sign_in_at, emailConfirmedAt: user.email_confirmed_at, metadata: user.user_metadata },
    profile: profileResult.data,
    subscription: subscriptionResult.data,
    notes: notesResult.data ?? [], tasks: tasksResult.data ?? [], payments: paymentsResult.data ?? [],
    entitlements: entitlementsResult.data ?? [], activities: activitiesResult.data ?? [], referralCredits: referralCreditsResult.data ?? []
  });
}));

adminRouter.post('/crm/users/:id/referral-credits', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const amountMinor = Number(req.body?.amountMinor);
  const note = String(req.body?.note || '').trim();
  if (!Number.isInteger(amountMinor) || amountMinor === 0) return res.status(400).json({ error: 'A non-zero credit amount in minor units is required.' });
  if (!note) return res.status(400).json({ error: 'An adjustment reason is required.' });
  const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const result = await adminCtx.serviceSupabase.from('referral_credits').insert({ user_id: req.params.id, kind: 'admin_adjustment', amount_minor: amountMinor, currency: String(req.body?.currency || 'GBP').toUpperCase(), status: 'available', available_at: new Date().toISOString(), expires_at: amountMinor > 0 ? expiresAt.toISOString() : null, note, created_by: adminCtx.identity.user.id }).select().single();
  if (result.error) return res.status(500).json({ error: result.error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'referral_credit_adjusted', `Referral credit adjusted by ${amountMinor} minor units`, { creditId: result.data.id, amountMinor, note });
  return res.status(201).json(result.data);
}));

adminRouter.patch('/crm/users/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const allowed = ['preferred_name', 'pronouns', 'location_region', 'life_stage', 'phone', 'company', 'address', 'crm_status', 'crm_owner_id'];
  const updates = Object.fromEntries(allowed.filter((key) => req.body?.[key] !== undefined).map((key) => [key, req.body[key]]));
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No supported profile changes supplied.' });
  const { data, error } = await adminCtx.serviceSupabase.from('profiles').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'profile_updated', 'Customer details updated', { fields: Object.keys(updates) });
  return res.json(data);
}));

adminRouter.post('/crm/users/:id/notes', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'Note text is required.' });
  const { data, error } = await adminCtx.serviceSupabase.from('crm_notes').insert({ user_id: req.params.id, body, created_by: adminCtx.identity.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'note_added', 'CRM note added');
  return res.status(201).json(data);
}));

adminRouter.post('/crm/users/:id/tasks', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'Task title is required.' });
  const { data, error } = await adminCtx.serviceSupabase.from('crm_tasks').insert({ user_id: req.params.id, title, description: req.body?.description || null, priority: req.body?.priority || 'normal', due_at: req.body?.dueAt || null, assigned_to: adminCtx.identity.user.id, created_by: adminCtx.identity.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'task_created', `Task created: ${title}`);
  return res.status(201).json(data);
}));

adminRouter.post('/crm/users/:id/entitlements', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
  if (!productId) return res.status(400).json({ error: 'Select a product.' });
  const { data, error } = await adminCtx.serviceSupabase.from('crm_entitlements').insert({ user_id: req.params.id, product_id: productId, source: req.body?.source === 'promotion' ? 'promotion' : 'manual', ends_at: req.body?.endsAt || null, reason: req.body?.reason || null, assigned_by: adminCtx.identity.user.id }).select('*, crm_products(name, price_minor, currency, billing_interval)').single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'subscription_assigned', `Access assigned: ${data.crm_products?.name ?? 'product'}`, { productId });
  return res.status(201).json(data);
}));

adminRouter.post('/crm/users/:id/paypal-subscriptions', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const { data: product, error } = await adminCtx.serviceSupabase.from('crm_products').select('id, name, paypal_plan_id, billing_interval, active').eq('id', req.body?.productId).maybeSingle();
  if (error || !product) return res.status(404).json({ error: 'Subscription product not found.' });
  if (!product.active || product.billing_interval === 'one_time' || !product.paypal_plan_id) return res.status(400).json({ error: 'This product is not an active PayPal subscription plan.' });
  const appUrl = (process.env.APP_URL || 'https://q-ai.online').replace(/\/+$/, '');
  const subscription = await paypalRequest('/v1/billing/subscriptions', { method: 'POST', headers: { 'PayPal-Request-Id': `q-crm-${req.params.id}-${product.id}-${Date.now()}` }, body: JSON.stringify({ plan_id: product.paypal_plan_id, custom_id: req.params.id, application_context: { brand_name: 'Q Intelligence', user_action: 'SUBSCRIBE_NOW', return_url: `${appUrl}/app?paypal=success`, cancel_url: `${appUrl}/app?paypal=cancel` } }) });
  const approvalUrl = subscription.links?.find((link: any) => link.rel === 'approve')?.href;
  if (!approvalUrl) return res.status(502).json({ error: 'PayPal returned no customer approval link.' });
  await adminCtx.serviceSupabase.from('subscriptions').upsert({ user_id: req.params.id, paypal_subscription_id: subscription.id, paypal_plan_id: product.paypal_plan_id, status: subscription.status || 'APPROVAL_PENDING', current_period_end: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'paypal_subscription_created', `PayPal approval requested for ${product.name}`, { productId: product.id, subscriptionId: subscription.id });
  return res.status(201).json({ approvalUrl, subscriptionId: subscription.id, status: subscription.status || 'APPROVAL_PENDING' });
}));

adminRouter.post('/crm/users/:id/payments', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const amountMinor = Number(req.body?.amountMinor);
  if (!Number.isInteger(amountMinor) || amountMinor < 0 || !req.body?.providerTransactionId) return res.status(400).json({ error: 'A valid amount and PayPal transaction ID are required.' });
  const { data, error } = await adminCtx.serviceSupabase.from('crm_payments').insert({ user_id: req.params.id, provider: 'paypal', provider_transaction_id: String(req.body.providerTransactionId).trim(), amount_minor: amountMinor, currency: String(req.body?.currency || 'GBP').toUpperCase(), status: req.body?.status || 'completed', payment_type: req.body?.paymentType || 'one_time', description: req.body?.description || null, recorded_by: adminCtx.identity.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'payment_recorded', `PayPal payment recorded: ${data.currency} ${(data.amount_minor / 100).toFixed(2)}`, { transactionId: data.provider_transaction_id });
  return res.status(201).json(data);
}));

adminRouter.get('/crm/products', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res);
  if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase
    .from('crm_products')
    .select('id, name, description, price_minor, currency, billing_interval, paypal_product_id, paypal_plan_id, paypal_sync_status, paypal_last_synced_at, active, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
}));

adminRouter.post('/crm/products', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const priceMinor = Number(req.body?.priceMinor);
  const interval = req.body?.billingInterval;
  if (!name || !Number.isInteger(priceMinor) || priceMinor < 0 || !['one_time', 'month', 'year'].includes(interval)) {
    return res.status(400).json({ error: 'Name, a valid non-negative price, and billing interval are required.' });
  }
  const { data, error } = await adminCtx.serviceSupabase.from('crm_products').insert({
    name,
    description: typeof req.body?.description === 'string' ? req.body.description.trim() || null : null,
    price_minor: priceMinor,
    currency: typeof req.body?.currency === 'string' ? req.body.currency.trim().toUpperCase() : 'GBP',
    billing_interval: interval,
    paypal_plan_id: typeof req.body?.paypalPlanId === 'string' ? req.body.paypalPlanId.trim() || null : null,
    active: req.body?.active !== false
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  try { return res.status(201).json(await syncProductToPayPal(adminCtx.serviceSupabase, data)); }
  catch (syncError: any) { return res.status(502).json({ error: `Product saved in Q but PayPal sync failed: ${syncError.message}` }); }
}));

adminRouter.patch('/crm/products/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const updates: Record<string, unknown> = {};
  if (typeof req.body?.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
  if (typeof req.body?.description === 'string') updates.description = req.body.description.trim() || null;
  if (Number.isInteger(req.body?.priceMinor) && req.body.priceMinor >= 0) updates.price_minor = req.body.priceMinor;
  if (typeof req.body?.currency === 'string' && req.body.currency.trim().length === 3) updates.currency = req.body.currency.trim().toUpperCase();
  if (['one_time', 'month', 'year'].includes(req.body?.billingInterval)) updates.billing_interval = req.body.billingInterval;
  if (typeof req.body?.paypalPlanId === 'string') updates.paypal_plan_id = req.body.paypalPlanId.trim() || null;
  if (typeof req.body?.active === 'boolean') updates.active = req.body.active;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid product changes supplied.' });
  const { data, error } = await adminCtx.serviceSupabase.from('crm_products').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  try { return res.json(await syncProductToPayPal(adminCtx.serviceSupabase, data)); }
  catch (syncError: any) { return res.status(502).json({ error: `Product updated in Q but PayPal sync failed: ${syncError.message}` }); }
}));

adminRouter.post('/password-reset-requests', asyncHandler(async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!email) {
      return res.status(400).json({ error: 'An email address is required.' });
    }

    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) {
      return res.status(503).json({ error: 'Password reset requests are not configured. Please set SUPABASE_SERVICE_ROLE_KEY in environment variables.' });
    }

    const { data, error } = await serviceSupabase
      .from('password_reset_requests')
      .insert({
        email,
        message: message || null,
        status: 'pending'
      })
      .select('id, email, message, created_at, status')
      .single();

    if (error) {
      console.error('[Admin] password_reset_requests insert failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to save the password reset request.' });
    }

    const request: PasswordResetRequest = data ? mapPasswordResetRequest(data) : {
      id: '',
      email,
      message: message || null,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    return res.json({ success: true, request });
  } catch (error: any) {
    console.error('[Admin] Failed to submit password reset request:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit request.' });
  }
}));

adminRouter.get('/password-reset-requests', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireAdmin(req, res);
    if (!adminCtx) return;

    const { data, error } = await adminCtx.serviceSupabase
      .from('password_reset_requests')
      .select('id, email, message, created_at, status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin] password_reset_requests select failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to retrieve reset requests.' });
    }

    return res.json((data ?? []).map(mapPasswordResetRequest));
  } catch (error: any) {
    console.error('[Admin] GET password-reset-requests failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve reset requests.' });
  }
}));

adminRouter.post('/password-reset-requests/:id/reset', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireAdmin(req, res);
    if (!adminCtx) return;
    const { serviceSupabase } = adminCtx;

    const { data: requestRow, error: requestError } = await serviceSupabase
      .from('password_reset_requests')
      .select('id, email, message, created_at, status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (requestError) {
      console.error('[Admin] password_reset_requests lookup failed:', requestError);
      return res.status(500).json({ error: requestError.message || 'Password reset request lookup failed.' });
    }

    if (!requestRow) {
      return res.status(404).json({ error: 'Password reset request not found.' });
    }

    const request = mapPasswordResetRequest(requestRow);
    const tempPassword = generateTemporaryPassword();
    const { data: usersData, error: lookupError } = await serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const targetUser = usersData?.users?.find((u: any) => u.email?.toLowerCase() === request.email.toLowerCase());

    if (lookupError) {
      console.error('[Admin] listUsers error:', lookupError);
    }

    if (!targetUser?.id) {
      await serviceSupabase
        .from('password_reset_requests')
        .update({ status: 'failed' })
        .eq('id', request.id);
      return res.status(404).json({ error: `No registered user found for email: ${request.email}` });
    }

    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(targetUser.id, {
      password: tempPassword,
      email_confirm: true
    });

    if (updateError) {
      console.error('[Admin] updateUserById error:', updateError);
      await serviceSupabase
        .from('password_reset_requests')
        .update({ status: 'failed' })
        .eq('id', request.id);
      return res.status(400).json({ error: updateError.message || 'Supabase user password update failed.' });
    }

    let recoveryLink: string | undefined;
    try {
      const { data: linkData } = await serviceSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: request.email
      });
      if (linkData?.properties?.action_link) {
        recoveryLink = linkData.properties.action_link;
      }
    } catch (linkErr) {
      console.warn('[Admin] Recovery link generation error:', linkErr);
    }

    const { data: updatedRequest, error: updateRequestError } = await serviceSupabase
      .from('password_reset_requests')
      .update({ status: 'reset', handled_at: new Date().toISOString(), handled_by: adminCtx.identity.user.id })
      .eq('id', request.id)
      .select('id, email, message, created_at, status')
      .single();

    if (updateRequestError) {
      console.error('[Admin] password_reset_requests status update failed:', updateRequestError);
    }

    return res.json({
      success: true,
      tempPassword,
      recoveryLink,
      request: updatedRequest ? mapPasswordResetRequest(updatedRequest) : { ...request, status: 'reset' }
    });
  } catch (error: any) {
    console.error('[Admin] Password reset failed:', error);
    return res.status(500).json({ error: error.message || 'Unable to reset the password.' });
  }
}));

adminRouter.post('/direct-password-reset', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireAdmin(req, res);
    if (!adminCtx) return;
    const { serviceSupabase } = adminCtx;

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const tempPassword = generateTemporaryPassword();
    const { data: usersData, error: lookupError } = await serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const targetUser = usersData?.users?.find((u: any) => u.email?.toLowerCase() === email);

    if (lookupError) {
      console.error('[Admin] listUsers error:', lookupError);
    }

    if (!targetUser?.id) {
      return res.status(404).json({ error: `No registered user found with email: ${email}` });
    }

    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(targetUser.id, {
      password: tempPassword,
      email_confirm: true
    });

    if (updateError) {
      console.error('[Admin] Direct updateUserById error:', updateError);
      return res.status(400).json({ error: updateError.message || 'Supabase password update failed.' });
    }

    let recoveryLink: string | undefined;
    try {
      const { data: linkData } = await serviceSupabase.auth.admin.generateLink({
        type: 'recovery',
        email
      });
      if (linkData?.properties?.action_link) {
        recoveryLink = linkData.properties.action_link;
      }
    } catch (linkErr) {
      console.warn('[Admin] Recovery link generation error:', linkErr);
    }

    return res.json({ success: true, email, tempPassword, recoveryLink });
  } catch (error: any) {
    console.error('[Admin] Direct password reset failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to reset password.' });
  }
}));

adminRouter.get('/provider-insights', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireAdmin(req, res);
    if (!adminCtx) return;
    const { serviceSupabase } = adminCtx;

    const { data, error } = await serviceSupabase.from('providers').select('id, org_type, verification_status');
    if (error) throw error;
    return res.json({
      generatedAt: new Date().toISOString(),
      totalProviders: data?.length ?? 0,
      verifiedCount: data?.filter((provider) => provider.verification_status === 'verified').length ?? 0,
      reportType: 'partner_value_preview'
    });
  } catch (error: any) {
    console.error('[Admin] Provider insights error:', error);
    return res.status(500).json({ error: error.message || 'Could not fetch provider metrics.' });
  }
}));

adminRouter.get('/data-moat-export', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireAdmin(req, res);
    if (!adminCtx) return;
    const { serviceSupabase } = adminCtx;

    const [{ data: messages, error: messagesError }, { data: feedback, error: feedbackError }] = await Promise.all([
      serviceSupabase.from('chat_messages').select('user_id, content, created_at').order('created_at'),
      serviceSupabase.from('sentiment_feedback').select('flagged_unsafe, score')
    ]);
    if (messagesError || feedbackError) throw messagesError ?? feedbackError;
    return res.json(buildAnalyticsExport(messages ?? [], feedback ?? []));
  } catch (error: any) {
    console.error('[Admin] Data export error:', error);
    return res.status(500).json({ error: error.message || 'Aggregate export failed privacy validation.' });
  }
}));
