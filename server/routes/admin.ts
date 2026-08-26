import express from 'express';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, asyncHandler } from '../middleware.js';
import { buildAnalyticsExport } from '../analyticsEngine.js';

export const adminRouter = express.Router();

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

adminRouter.get('/me', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;

  return res.json({
    success: true,
    user: {
      id: adminCtx.identity.user.id,
      email: adminCtx.identity.user.email
    },
    role: 'partner_admin'
  });
}));

adminRouter.get('/crm/users', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
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

adminRouter.get('/crm/products', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase
    .from('crm_products')
    .select('id, name, description, price_minor, currency, billing_interval, paypal_plan_id, active, created_at, updated_at')
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
  return res.status(201).json(data);
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
  return res.json(data);
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
