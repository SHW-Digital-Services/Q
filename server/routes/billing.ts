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

function getPaypalBaseUrl(): string {
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

async function getPayPalAccessToken(): Promise<string> {
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
