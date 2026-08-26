import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, asyncHandler } from '../middleware.js';

export const billingRouter = express.Router();

function getServiceSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  } catch (err) {
    console.warn('[Billing] Supabase client init warning:', err);
    return null;
  }
}

export function getPaypalBaseUrl(): string {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function getPaypalEnvironment(): 'live' | 'sandbox' {
  return process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
}

function hasInvalidPayPalResource(details: any[]): boolean {
  return details.some((detail) => detail?.issue === 'INVALID_RESOURCE_ID');
}

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment variables.');
  }

  const paypalBaseUrl = getPaypalBaseUrl();
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PayPal authentication failed (${response.status}): ${errText}`);
  }

  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('PayPal returned no access token.');
  return data.access_token;
}

function getAppUrl(req: express.Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL.startsWith('http')
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
    return url.replace(/\/+$/, '');
  }
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  if (host) {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

async function savePayPalSubscription(subscription: any, fallbackUserId?: string) {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return;
  const userId = subscription.custom_id || fallbackUserId;
  if (!userId || !subscription.id || !subscription.plan_id) return;

  const allowedStatuses = new Set(['APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']);
  const status = allowedStatuses.has(subscription.status) ? subscription.status : 'APPROVAL_PENDING';
  
  await serviceSupabase.from('subscriptions').upsert({
    user_id: userId,
    paypal_subscription_id: subscription.id,
    paypal_plan_id: subscription.plan_id,
    status,
    current_period_end: subscription.billing_info?.next_billing_time ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
}

async function paypalApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${getPaypalBaseUrl()}${path}`, { ...init, headers: { Authorization: `Bearer ${await getPayPalAccessToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `PayPal request failed (${response.status}).`);
  return data;
}

async function qualifyReferralAndApplyCredit(db: any, event: any, subscription: any, amountMinor: number, currency: string) {
  const userId = subscription.custom_id;
  if (!userId || amountMinor <= 0) return;
  const now = new Date();
  const referralResult = await db.from('referrals').select('*').eq('prospect_user_id', userId).eq('status', 'signed_up').maybeSingle();
  if (referralResult.data) {
    const claimed = await db.from('referrals').update({ status: 'qualified', qualified_at: now.toISOString() }).eq('id', referralResult.data.id).eq('status', 'signed_up').select().maybeSingle();
    if (claimed.error) throw claimed.error;
    const referral = claimed.data;
    if (referral) {
    const expiresAt = new Date(now); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const availableAt = new Date(now); availableAt.setDate(availableAt.getDate() + 14);
    const welcome = await db.from('referral_credits').insert({ user_id: userId, referral_id: referral.id, kind: 'referred_customer', amount_minor: Math.round(amountMinor * 0.10), currency, status: 'available', available_at: now.toISOString(), expires_at: expiresAt.toISOString(), note: '10% referred-customer first-payment credit' });
    if (welcome.error && welcome.error.code !== '23505') throw welcome.error;
    const earned = await db.from('referral_credits').insert({ user_id: referral.referrer_user_id, referral_id: referral.id, kind: 'referrer', amount_minor: Math.round(amountMinor * 0.20), currency, status: 'pending', available_at: availableAt.toISOString(), expires_at: expiresAt.toISOString(), note: '20% successful-referral reward; available after 14 days' });
    if (earned.error && earned.error.code !== '23505') throw earned.error;
    }
  }

  await db.from('referral_credits').update({ status: 'available' }).eq('user_id', userId).eq('status', 'pending').lte('available_at', now.toISOString());
  await db.from('referral_credits').update({ status: 'expired' }).eq('user_id', userId).in('status', ['pending','available']).lt('expires_at', now.toISOString());
  const creditResult = await db.from('referral_credits').select('kind,amount_minor,status').eq('user_id', userId).eq('currency', currency).in('status', ['available','used']);
  if (creditResult.error) throw creditResult.error;
  const balance = (creditResult.data ?? []).reduce((sum:number, row:any) => sum + (row.status === 'available' || row.kind === 'redemption' ? row.amount_minor : 0), 0);
  const creditToApply = Math.max(0, Math.min(balance, Math.floor(amountMinor * 0.50)));
  if (!creditToApply || !event.resource?.id) return;
  const existing = await db.from('referral_credits').select('id').eq('paypal_sale_id', event.resource.id).eq('kind', 'redemption').maybeSingle();
  if (existing.data) return;
  await paypalApi(`/v1/payments/sale/${encodeURIComponent(event.resource.id)}/refund`, { method: 'POST', headers: { 'PayPal-Request-Id': `q-credit-${event.id}` }, body: JSON.stringify({ amount: { total: (creditToApply / 100).toFixed(2), currency }, description: 'Q referral credit' }) });
  const redemption = await db.from('referral_credits').insert({ user_id: userId, kind: 'redemption', amount_minor: -creditToApply, currency, status: 'used', available_at: now.toISOString(), paypal_sale_id: event.resource.id, note: 'Automatically applied to subscription payment' });
  if (redemption.error && redemption.error.code !== '23505') throw redemption.error;
}

async function verifyPayPalWebhook(req: express.Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not configured.');
  const fields = {
    transmission_id: req.header('paypal-transmission-id'), transmission_time: req.header('paypal-transmission-time'),
    cert_url: req.header('paypal-cert-url'), auth_algo: req.header('paypal-auth-algo'), transmission_sig: req.header('paypal-transmission-sig')
  };
  if (Object.values(fields).some((value) => !value)) return false;
  const response = await fetch(`${getPaypalBaseUrl()}/v1/notifications/verify-webhook-signature`, { method: 'POST', headers: { Authorization: `Bearer ${await getPayPalAccessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, webhook_id: webhookId, webhook_event: req.body }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.verification_status === 'SUCCESS';
}

// POST /api/billing/paypal/webhook - PayPal is authoritative for billing state.
billingRouter.post('/paypal/webhook', asyncHandler(async (req, res) => {
  if (!(await verifyPayPalWebhook(req))) return res.status(400).json({ error: 'Invalid PayPal webhook signature.' });
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.status(503).json({ error: 'Billing database is unavailable.' });
  const event = req.body;
  if (!event?.id || !event?.event_type) return res.status(400).json({ error: 'Invalid webhook event.' });
  const { data: existing } = await serviceSupabase.from('paypal_webhook_events').select('id').eq('id', event.id).maybeSingle();
  if (existing) return res.json({ received: true, duplicate: true });

  const type = String(event.event_type);
  const resource = event.resource ?? {};
  if (type.startsWith('BILLING.SUBSCRIPTION.')) {
    const subscription = resource.custom_id ? resource : await paypalApi(`/v1/billing/subscriptions/${encodeURIComponent(resource.id)}`);
    await savePayPalSubscription(subscription);
  }
  if (['PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED'].includes(type)) {
    const subscriptionId = resource.billing_agreement_id;
    if (subscriptionId) {
      const subscription = await paypalApi(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
      await savePayPalSubscription(subscription);
      if (subscription.custom_id) {
        const amount = resource.amount ?? resource.total ?? {};
        const amountMinor = Math.round(Number(amount.total ?? amount.value ?? 0) * 100);
        const currency = String(amount.currency ?? amount.currency_code ?? 'GBP').toUpperCase();
        await serviceSupabase.from('crm_payments').upsert({ user_id: subscription.custom_id, provider: 'paypal', provider_transaction_id: resource.id, amount_minor: amountMinor, currency, status: type === 'PAYMENT.SALE.COMPLETED' ? 'completed' : 'refunded', payment_type: type === 'PAYMENT.SALE.COMPLETED' ? 'subscription' : 'refund', description: event.summary ?? type, occurred_at: resource.create_time ?? event.create_time ?? new Date().toISOString() }, { onConflict: 'provider,provider_transaction_id' });
        if (type === 'PAYMENT.SALE.COMPLETED') await qualifyReferralAndApplyCredit(serviceSupabase, event, subscription, amountMinor, currency);
      }
    }
  }
  if (type.startsWith('CATALOG.PRODUCT.')) {
    const remote = resource.name ? resource : await paypalApi(`/v1/catalogs/products/${encodeURIComponent(resource.id)}`);
    await serviceSupabase.from('crm_products').update({ name: remote.name, description: remote.description ?? null, paypal_sync_status: 'synced', paypal_last_synced_at: new Date().toISOString() }).eq('paypal_product_id', remote.id);
  }
  if (type.startsWith('BILLING.PLAN.')) {
    const plan = resource.billing_cycles ? resource : await paypalApi(`/v1/billing/plans/${encodeURIComponent(resource.id)}`);
    const regular = plan.billing_cycles?.find((cycle: any) => cycle.tenure_type === 'REGULAR') ?? plan.billing_cycles?.[0];
    const price = regular?.pricing_scheme?.fixed_price;
    const interval = regular?.frequency?.interval_unit === 'YEAR' ? 'year' : 'month';
    const updates = { name: plan.name, description: plan.description ?? null, paypal_product_id: plan.product_id, paypal_plan_id: plan.id, price_minor: Math.round(Number(price?.value ?? 0) * 100), currency: price?.currency_code ?? 'GBP', billing_interval: interval, active: plan.status === 'ACTIVE', paypal_sync_status: 'synced', paypal_last_synced_at: new Date().toISOString() };
    const { data: found } = await serviceSupabase.from('crm_products').select('id').eq('paypal_plan_id', plan.id).maybeSingle();
    if (found) await serviceSupabase.from('crm_products').update(updates).eq('id', found.id);
    else await serviceSupabase.from('crm_products').insert(updates);
  }
  await serviceSupabase.from('paypal_webhook_events').insert({ id: event.id, event_type: type, resource_id: resource.id ?? null });
  return res.json({ received: true });
}));

// POST /api/billing/paypal/create-subscription
billingRouter.post('/paypal/create-subscription', asyncHandler(async (req, res) => {
  const identity = await getAuthenticatedUser(req);
  if (!identity) return res.status(401).json({ error: 'Authentication required. Please sign in.' });

  const planName = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
  const planId = planName === 'yearly'
    ? process.env.PAYPAL_PLAN_ID_YEARLY
    : process.env.PAYPAL_PLAN_ID_MONTHLY;

  if (!planId) {
    const missingVar = planName === 'yearly' ? 'PAYPAL_PLAN_ID_YEARLY' : 'PAYPAL_PLAN_ID_MONTHLY';
    return res.status(503).json({ error: `PayPal subscription plan is not configured. Missing environment variable: ${missingVar}` });
  }

  try {
    const remotePlan = await paypalApi(`/v1/billing/plans/${encodeURIComponent(planId)}`);
    if (remotePlan.status !== 'ACTIVE') return res.status(409).json({ error: 'This subscription plan is currently unavailable.' });
  } catch {
    return res.status(409).json({ error: 'This subscription plan is currently unavailable.' });
  }

  const serviceSupabase = getServiceSupabase();
  if (serviceSupabase) {
    const linkedProduct = await serviceSupabase.from('crm_products').select('active,paypal_sync_status').eq('paypal_plan_id', planId).maybeSingle();
    if (linkedProduct.error) return res.status(503).json({ error: 'Unable to verify subscription plan availability.' });
    if (linkedProduct.data && (!linkedProduct.data.active || linkedProduct.data.paypal_sync_status !== 'synced')) return res.status(409).json({ error: 'This subscription plan is currently unavailable.' });
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const appUrl = getAppUrl(req);
    const paypalBaseUrl = getPaypalBaseUrl();

    const paypalResponse = await fetch(`${paypalBaseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'PayPal-Request-Id': `q-${identity.user.id}-${Date.now()}`
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: identity.user.id,
        application_context: {
          brand_name: 'Q',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${appUrl}/app?paypal=success`,
          cancel_url: `${appUrl}/app?paypal=cancel`
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await paypalResponse.json() as { links?: Array<{ rel?: string; href?: string }>; message?: string; details?: any[] };
    if (!paypalResponse.ok) {
      const details = data.details ?? [];
      const paypalReason = details
        .map((detail: any) => `${detail.field ?? 'unknown_field'}: ${detail.issue ?? 'PAYPAL_ERROR'} (${detail.description ?? ''})`)
        .join('; ');

      const environment = getPaypalEnvironment();
      const invalidPlanMessage = hasInvalidPayPalResource(details)
        ? `PayPal could not find the ${planName} plan ID in the ${environment} environment. Check PAYPAL_PLAN_ID_${planName.toUpperCase()} belongs to the same ${environment} PayPal app/account and that the plan is active.`
        : null;

      console.error('[Billing] PayPal rejected subscription:', {
        status: paypalResponse.status,
        message: data.message,
        plan: planName,
        environment,
        reason: invalidPlanMessage || paypalReason
      });
      return res.status(502).json({
        error: 'PayPal could not create subscription.',
        detail: invalidPlanMessage || paypalReason || data.message || `PayPal status code ${paypalResponse.status}`
      });
    }

    const approvalUrl = data.links?.find((link) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      return res.status(502).json({ error: 'PayPal returned no approval URL.' });
    }

    return res.json({ approvalUrl });
  } catch (error: any) {
    console.error('[Billing] Create subscription failed:', error);
    return res.status(503).json({ error: error.message || 'PayPal is currently unavailable.' });
  }
}));

// GET /api/billing/paypal/plans - public plan availability, synchronized by PayPal webhooks.
billingRouter.get('/paypal/plans', asyncHandler(async (_req, res) => {
  const serviceSupabase = getServiceSupabase();
  const configured = [
    { key: 'monthly', planId: process.env.PAYPAL_PLAN_ID_MONTHLY },
    { key: 'yearly', planId: process.env.PAYPAL_PLAN_ID_YEARLY }
  ];
  const plans = await Promise.all(configured.filter(plan => plan.planId).map(async plan => {
    try {
      const remote = await paypalApi(`/v1/billing/plans/${encodeURIComponent(plan.planId!)}`);
      const available = remote.status === 'ACTIVE';
      if (serviceSupabase) await serviceSupabase.from('crm_products').update({ active: available, paypal_sync_status: 'synced', paypal_last_synced_at: new Date().toISOString() }).eq('paypal_plan_id', plan.planId!);
      return { key: plan.key, available };
    } catch {
      return { key: plan.key, available: false };
    }
  }));
  return res.json({ plans });
}));

// POST /api/billing/paypal/complete
billingRouter.post('/paypal/complete', asyncHandler(async (req, res) => {
  const identity = await getAuthenticatedUser(req);
  if (!identity) return res.status(401).json({ error: 'Authentication required.' });

  const subscriptionId = req.body?.subscriptionId;
  const token = req.body?.token;
  if (!subscriptionId && !token) {
    return res.status(400).json({ error: 'subscriptionId or token is required.' });
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const paypalBaseUrl = getPaypalBaseUrl();
    const targetId = subscriptionId || token;

    const paypalResponse = await fetch(`${paypalBaseUrl}/v1/billing/subscriptions/${encodeURIComponent(targetId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      if (paypalResponse.status === 404 || paypalResponse.status === 400) {
        return res.json({ success: true, pending: true, status: 'APPROVAL_PENDING' });
      }
      return res.status(502).json({ error: 'Unable to verify PayPal subscription.', detail: data });
    }

    await savePayPalSubscription(data, identity.user.id);
    return res.json({ success: true, pending: false, status: data.status, planId: data.plan_id });
  } catch (error: any) {
    console.error('[Billing] Complete subscription failed:', error);
    return res.status(503).json({ error: error.message || 'PayPal subscription verification failed.' });
  }
}));

// GET /api/billing/paypal/status
billingRouter.get('/paypal/status', asyncHandler(async (req, res) => {
  const identity = await getAuthenticatedUser(req);
  if (!identity) return res.status(401).json({ error: 'Authentication required.' });
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    return res.json({ status: 'Not subscribed', message: 'Subscription database service role key not configured.' });
  }

  try {
    const { data, error } = await serviceSupabase
      .from('subscriptions')
      .select('status,paypal_plan_id')
      .eq('user_id', identity.user.id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json({ status: 'Not subscribed' });
    return res.json({ status: data.status || 'Unknown', planId: data.paypal_plan_id });
  } catch (error: any) {
    console.error('[Billing] Subscription status failed:', error);
    return res.status(503).json({ error: 'Unable to retrieve subscription status.' });
  }
}));
