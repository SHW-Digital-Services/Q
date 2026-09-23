import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, asyncHandler, getCanonicalAppUrl, sendOpaqueError } from '../middleware.js';
import { buildAnalyticsExport } from '../analyticsEngine.js';
import { getPayPalAccessToken, getPaypalBaseUrl } from './billing.js';
import { createAdminSecurityMiddleware, requireExactObject } from '../security.js';

export const adminRouter = express.Router();

adminRouter.get('/site-settings/launch', asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.json({ enabled: false });
  const { data } = await serviceSupabase.from('site_settings').select('value').eq('key', 'launch_override').maybeSingle();
  return res.json({ enabled: data?.value === true });
}));

export function getServiceSupabase() {
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
  status: 'pending' | 'reset' | 'temp_issued' | 'failed';
}

interface ContentPostPayload {
  title?: unknown;
  slug?: unknown;
  summary?: unknown;
  body?: unknown;
  contentType?: unknown;
  status?: unknown;
  tags?: unknown;
  heroImageUrl?: unknown;
}

function hashContentApiToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function isMissingContentSchema(error: any) {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes('content_api_clients') || message.includes('content_posts');
}

function sendContentSchemaMissing(res: express.Response) {
  return res.status(503).json({
    error: 'Content publishing is not configured yet. Ask an admin to apply the content publishing Supabase migration.',
    code: 'CONTENT_PUBLISHING_NOT_CONFIGURED'
  });
}

adminRouter.use(createAdminSecurityMiddleware(getServiceSupabase));

async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPaypalBaseUrl()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.details?.[0]?.description || `PayPal request failed (${response.status}).`);
  return data;
}

function paypalText(value: unknown, maximumLength: number, fallback: string) {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return Array.from(text).slice(0, maximumLength).join('');
}

async function syncProductToPayPal(serviceSupabase: any, product: any) {
  try {
    const productName = paypalText(product.name, 127, 'Q subscription');
    const productDescription = paypalText(product.description, 256, productName);
    const planDescription = paypalText(product.description, 127, productName);
    let paypalProductId = product.paypal_product_id;
    if (!paypalProductId) {
      const remoteProduct = await paypalRequest('/v1/catalogs/products', { method: 'POST', body: JSON.stringify({ name: productName, description: productDescription, type: 'SERVICE', category: 'SOFTWARE' }) });
      paypalProductId = remoteProduct.id;
      const { error } = await serviceSupabase.from('crm_products').update({ paypal_product_id: paypalProductId }).eq('id', product.id);
      if (error) throw error;
    } else {
      await paypalRequest(`/v1/catalogs/products/${encodeURIComponent(paypalProductId)}`, { method: 'PATCH', body: JSON.stringify([{ op: 'replace', path: '/name', value: productName }, { op: 'replace', path: '/description', value: productDescription }]) });
    }
    let paypalPlanId = product.paypal_plan_id;
    let paypalFounderPlanId = product.paypal_founder_plan_id;
    if (product.billing_interval !== 'one_time') {
      const price = (product.price_minor / 100).toFixed(2);
      if (!paypalPlanId) {
        const remotePlan = await paypalRequest('/v1/billing/plans', { method: 'POST', body: JSON.stringify({ product_id: paypalProductId, name: productName, description: planDescription, status: product.active ? 'ACTIVE' : 'CREATED', billing_cycles: [{ frequency: { interval_unit: product.billing_interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: price, currency_code: product.currency } } }], payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 } }) });
        paypalPlanId = remotePlan.id;
        const { error } = await serviceSupabase.from('crm_products').update({ paypal_plan_id: paypalPlanId }).eq('id', product.id);
        if (error) throw error;
      } else {
        await paypalRequest(`/v1/billing/plans/${encodeURIComponent(paypalPlanId)}`, { method: 'PATCH', body: JSON.stringify([{ op: 'replace', path: '/name', value: productName }, { op: 'replace', path: '/description', value: planDescription }]) });
        await paypalRequest(`/v1/billing/plans/${encodeURIComponent(paypalPlanId)}/update-pricing-schemes`, { method: 'POST', body: JSON.stringify({ pricing_schemes: [{ billing_cycle_sequence: 1, pricing_scheme: { fixed_price: { value: price, currency_code: product.currency } } }] }) });
      }
      const founderPrice = (product.price_minor * 0.5 / 100).toFixed(2);
      const founderCycles = product.billing_interval === 'year' ? 1 : 3;
      if (!paypalFounderPlanId) {
        const founderPlan = await paypalRequest('/v1/billing/plans', { method: 'POST', body: JSON.stringify({ product_id: paypalProductId, name: paypalText(`${productName} — Founding 100`, 127, 'Q Founding 100'), description: `50% introductory offer for the first 100 eligible Q subscribers`, status: product.active ? 'ACTIVE' : 'CREATED', billing_cycles: [{ frequency: { interval_unit: product.billing_interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'TRIAL', sequence: 1, total_cycles: founderCycles, pricing_scheme: { fixed_price: { value: founderPrice, currency_code: product.currency } } }, { frequency: { interval_unit: product.billing_interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 2, total_cycles: 0, pricing_scheme: { fixed_price: { value: price, currency_code: product.currency } } }], payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 } }) });
        paypalFounderPlanId = founderPlan.id;
        const { error } = await serviceSupabase.from('crm_products').update({ paypal_founder_plan_id: paypalFounderPlanId }).eq('id', product.id);
        if (error) throw error;
      } else {
        await paypalRequest(`/v1/billing/plans/${encodeURIComponent(paypalFounderPlanId)}/update-pricing-schemes`, { method: 'POST', body: JSON.stringify({ pricing_schemes: [{ billing_cycle_sequence: 1, pricing_scheme: { fixed_price: { value: founderPrice, currency_code: product.currency } } }, { billing_cycle_sequence: 2, pricing_scheme: { fixed_price: { value: price, currency_code: product.currency } } }] }) });
      }
    }
    const { data, error } = await serviceSupabase.from('crm_products').update({ paypal_product_id: paypalProductId, paypal_plan_id: paypalPlanId, paypal_founder_plan_id: paypalFounderPlanId, paypal_founder_plan_active: Boolean(paypalFounderPlanId && product.active), paypal_sync_status: 'synced', paypal_last_synced_at: new Date().toISOString() }).eq('id', product.id).select().single();
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

function normaliseSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function textField(value: unknown, maximumLength: number, required = false) {
  if (value === undefined || value === null) return required ? null : undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > maximumLength) return null;
  return trimmed || undefined;
}

function contentPostPayload(body: ContentPostPayload, actorId: string, partial = false) {
  const allowed = ['title', 'slug', 'summary', 'body', 'contentType', 'status', 'tags', 'heroImageUrl'] as const;
  if (!requireExactObject(body, allowed)) return { error: 'Unexpected request fields.' };

  const payload: Record<string, unknown> = { updated_by: actorId };
  const title = textField(body.title, 180, !partial);
  if (title === null) return { error: 'Title must be between 3 and 180 characters.' };
  if (title !== undefined) {
    if (title.length < 3) return { error: 'Title must be between 3 and 180 characters.' };
    payload.title = title;
    if (!partial && body.slug === undefined) payload.slug = normaliseSlug(title);
  }

  const slug = typeof body.slug === 'string' ? normaliseSlug(body.slug) : undefined;
  if (body.slug !== undefined && (!slug || slug.length < 3)) return { error: 'Slug must contain at least 3 URL-safe characters.' };
  if (slug) payload.slug = slug;

  const summary = textField(body.summary, 500, !partial);
  if (summary === null || (summary !== undefined && summary.length < 10)) return { error: 'Summary must be between 10 and 500 characters.' };
  if (summary !== undefined) payload.summary = summary;

  const postBody = textField(body.body, 20000, !partial);
  if (postBody === null || (postBody !== undefined && postBody.length < 20)) return { error: 'Body must be between 20 and 20,000 characters.' };
  if (postBody !== undefined) payload.body = postBody;

  if (body.contentType !== undefined) {
    if (!['news', 'update'].includes(String(body.contentType))) return { error: 'Content type must be news or update.' };
    payload.content_type = body.contentType;
  } else if (!partial) {
    payload.content_type = 'update';
  }

  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(String(body.status))) return { error: 'Status must be draft, published, or archived.' };
    payload.status = body.status;
    payload.published_at = body.status === 'published' ? new Date().toISOString() : null;
  } else if (!partial) {
    payload.status = 'draft';
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return { error: 'Tags must be an array.' };
    const tags = [...new Set(body.tags.map((tag) => typeof tag === 'string' ? tag.trim().toLowerCase() : '').filter(Boolean))].slice(0, 12);
    if (tags.some((tag) => tag.length > 40)) return { error: 'Tags must be 40 characters or fewer.' };
    payload.tags = tags;
  }

  const heroImageUrl = textField(body.heroImageUrl, 1000, false);
  if (heroImageUrl === null) return { error: 'Hero image URL is too long.' };
  if (heroImageUrl !== undefined) {
    if (heroImageUrl && !/^https?:\/\/|^\//i.test(heroImageUrl)) return { error: 'Hero image URL must be HTTPS or site-relative.' };
    payload.hero_image_url = heroImageUrl || null;
  }

  if (!partial) payload.created_by = actorId;
  return { payload };
}

function randomCharFrom(characters: string) {
  return characters[randomBytes(1)[0] % characters.length];
}

function shuffleCharacters(value: string) {
  const chars = value.split('');
  const bytes = randomBytes(chars.length);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[index] % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join('');
}

function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = `${uppercase}${lowercase}${digits}${symbols}`;
  const required = [uppercase, lowercase, digits, symbols].map(randomCharFrom).join('');
  const remaining = Array.from(randomBytes(16), (byte) => all[byte % all.length]).join('');
  return shuffleCharacters(`${required}${remaining}`);
}

async function findAuthUserByEmail(serviceSupabase: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data?.users?.find((user: any) => String(user.email ?? '').toLowerCase() === email);
    if (match) return match;
    if (!data?.users || data.users.length < 1000) return null;
  }
  return null;
}

async function issueTemporaryPassword(serviceSupabase: any, user: any, actorId: string, metadata: Record<string, unknown> = {}) {
  const temporaryPassword = generateTemporaryPassword();
  const { data, error } = await serviceSupabase.auth.admin.updateUserById(user.id, { password: temporaryPassword });
  if (error) throw error;
  await recordCrmActivity(serviceSupabase, user.id, actorId, 'temporary_password_issued', 'Temporary account password issued', metadata);
  const communicationLog = await recordCrmCommunication(serviceSupabase, {
    userId: user.id,
    direction: 'outbound',
    channel: 'email',
    status: 'logged',
    recipientEmail: user.email ?? null,
    subject: 'Q temporary account password',
    body: 'A temporary account password was issued by Q staff. The temporary password was displayed once in the CRM and was not stored in Q.',
    actorId,
    metadata: { source: 'temporary_password', ...metadata }
  });
  if (communicationLog.error) console.error('[Admin] Failed to record temporary password communication:', communicationLog.error);
  return { user: data?.user ?? user, temporaryPassword };
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
      res.status(503).json({ error: 'Administrative account access is temporarily unavailable.' });
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
    if (!serviceSupabase) { res.status(503).json({ error: 'Staff account access is temporarily unavailable.' }); return null; }
    const { data: profile, error } = await serviceSupabase.from('profiles').select('role,staff_permissions').eq('id', identity.user.id).maybeSingle();
    if (error) { res.status(500).json({ error: 'Staff role check failed.' }); return null; }
    if (!['staff', 'partner_admin'].includes(profile?.role)) { res.status(403).json({ error: 'Staff access required.' }); return null; }
    return { identity, serviceSupabase, role: profile.role as 'staff' | 'partner_admin', permissions: profile.staff_permissions ?? [] };
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
    role: adminCtx.role,
    permissions: adminCtx.permissions
  });
}));

adminRouter.patch('/site-settings/launch', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean.' });
  const { error } = await adminCtx.serviceSupabase.from('site_settings').upsert({ key: 'launch_override', value: req.body.enabled, updated_by: adminCtx.identity.user.id, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ enabled: req.body.enabled });
}));

adminRouter.get('/content', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const requestedLimit = Number.parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 250) : 100;
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_posts')
    .select('id,slug,title,summary,body,content_type,status,tags,hero_image_url,published_at,updated_at,created_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to load content posts.', 'Admin Content List', error);
  }
  return res.json(data ?? []);
}));

adminRouter.post('/content', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const parsed = contentPostPayload(req.body, adminCtx.identity.user.id);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_posts')
    .insert(parsed.payload)
    .select('id,slug,title,summary,body,content_type,status,tags,hero_image_url,published_at,updated_at,created_at')
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A post with that slug already exists.' });
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to create content post.', 'Admin Content Create', error);
  }
  return res.status(201).json(data);
}));

adminRouter.patch('/content/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const parsed = contentPostPayload(req.body, adminCtx.identity.user.id, true);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  if (Object.keys(parsed.payload).length <= 1) return res.status(400).json({ error: 'No valid content changes supplied.' });
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_posts')
    .update(parsed.payload)
    .eq('id', req.params.id)
    .select('id,slug,title,summary,body,content_type,status,tags,hero_image_url,published_at,updated_at,created_at')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A post with that slug already exists.' });
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to update content post.', 'Admin Content Update', error);
  }
  if (!data) return res.status(404).json({ error: 'Content post not found.' });
  return res.json(data);
}));

adminRouter.post('/content/:id/publish', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (!requireExactObject(req.body ?? {}, [])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_posts')
    .update({ status: 'published', published_at: new Date().toISOString(), updated_by: adminCtx.identity.user.id })
    .eq('id', req.params.id)
    .select('id,slug,title,summary,body,content_type,status,tags,hero_image_url,published_at,updated_at,created_at')
    .maybeSingle();
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to publish content post.', 'Admin Content Publish', error);
  }
  if (!data) return res.status(404).json({ error: 'Content post not found.' });
  return res.json(data);
}));

adminRouter.post('/content/:id/unpublish', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (!requireExactObject(req.body ?? {}, [])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_posts')
    .update({ status: 'draft', published_at: null, updated_by: adminCtx.identity.user.id })
    .eq('id', req.params.id)
    .select('id,slug,title,summary,body,content_type,status,tags,hero_image_url,published_at,updated_at,created_at')
    .maybeSingle();
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to unpublish content post.', 'Admin Content Unpublish', error);
  }
  if (!data) return res.status(404).json({ error: 'Content post not found.' });
  return res.json(data);
}));

adminRouter.delete('/content/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_posts')
    .update({ status: 'archived', published_at: null, updated_by: adminCtx.identity.user.id })
    .eq('id', req.params.id)
    .select('id,status')
    .maybeSingle();
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to archive content post.', 'Admin Content Archive', error);
  }
  if (!data) return res.status(404).json({ error: 'Content post not found.' });
  return res.json({ success: true, id: data.id, status: data.status });
}));

adminRouter.get('/content/api-clients', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_api_clients')
    .select('id,name,token_prefix,active,created_at,last_used_at,revoked_at')
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to load content API clients.', 'Admin Content API Clients', error);
  }
  return res.json(data ?? []);
}));

adminRouter.post('/content/api-clients', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (!requireExactObject(req.body, ['name'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 3 || name.length > 120) return res.status(400).json({ error: 'Client name must be between 3 and 120 characters.' });
  const token = `qcp_${randomBytes(32).toString('base64url')}`;
  const tokenPrefix = token.slice(0, 12);
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_api_clients')
    .insert({
      name,
      token_hash: hashContentApiToken(token),
      token_prefix: tokenPrefix,
      created_by: adminCtx.identity.user.id,
      approved_by: adminCtx.identity.user.id
    })
    .select('id,name,token_prefix,active,created_at,last_used_at,revoked_at')
    .single();
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to create content API client.', 'Admin Content API Client Create', error);
  }
  return res.status(201).json({ ...data, token });
}));

adminRouter.delete('/content/api-clients/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase
    .from('content_api_clients')
    .update({ active: false, revoked_by: adminCtx.identity.user.id, revoked_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('id,name,token_prefix,active,created_at,last_used_at,revoked_at')
    .maybeSingle();
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to revoke content API client.', 'Admin Content API Client Revoke', error);
  }
  if (!data) return res.status(404).json({ error: 'Content API client not found.' });
  return res.json(data);
}));

adminRouter.get('/staff', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  const [{ data: profiles, error }, { data: usersData, error: usersError }] = await Promise.all([
    adminCtx.serviceSupabase.from('profiles').select('id, role, staff_permissions, preferred_name, created_at').in('role', ['staff', 'partner_admin']).order('created_at'),
    adminCtx.serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);
  if (error || usersError) return res.status(500).json({ error: error?.message || usersError?.message || 'Unable to load staff.' });
  const usersById = new Map((usersData?.users ?? []).map((user: any) => [user.id, user]));
  return res.json((profiles ?? []).map((profile: any) => ({ ...profile, email: (usersById.get(profile.id) as any)?.email ?? '' })));
}));

adminRouter.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (!requireExactObject(req.body, ['role'])) return res.status(400).json({ error: 'Unexpected request fields.' });
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

adminRouter.patch('/users/:id/permissions', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res); if (!adminCtx) return;
  if (!requireExactObject(req.body, ['permissions']) || !Array.isArray(req.body.permissions)) return res.status(400).json({ error: 'permissions must be an array.' });
  const supported = ['crm.read', 'crm.sensitive', 'crm.write', 'billing.read', 'billing.write', 'support.read', 'support.write', 'security.admin', 'analytics.export'];
  const permissions = [...new Set(req.body.permissions)];
  if (permissions.length > supported.length || permissions.some((permission) => typeof permission !== 'string' || !supported.includes(permission))) {
    return res.status(400).json({ error: 'One or more staff permissions are invalid.' });
  }
  const result = await adminCtx.serviceSupabase.from('profiles').update({ staff_permissions: permissions }).eq('id', req.params.id).eq('role', 'staff').select('id,role,staff_permissions').maybeSingle();
  if (result.error) return sendOpaqueError(req, res, 500, 'Unable to update staff permissions.', 'Admin Staff Permissions', result.error);
  if (!result.data) return res.status(404).json({ error: 'Staff profile not found.' });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'staff_permissions_changed', 'Staff permissions updated', { permissions });
  return res.json(result.data);
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
  if (!requireExactObject(req.body, ['email', 'name', 'role'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const requestedRole = req.body?.role;
  const role = staffCtx.role === 'partner_admin' && ['user', 'staff', 'partner_admin'].includes(requestedRole) ? requestedRole : 'user';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email address is required.' });
  const redirectTo = `${getCanonicalAppUrl()}/app`;
  const authResult = await staffCtx.serviceSupabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name: name || email.split('@')[0], invited_by_q_crm: true } });
  if (authResult.error || !authResult.data?.user) return sendOpaqueError(req, res, 400, 'Unable to send the account invitation.', 'Admin Invite User', authResult.error);
  const { error: profileError } = await staffCtx.serviceSupabase.from('profiles').upsert({ id: authResult.data.user.id, preferred_name: name || null, role, crm_status: 'customer' }, { onConflict: 'id' });
  if (profileError) return res.status(500).json({ error: `Invitation sent, but the CRM profile could not be prepared: ${profileError.message}` });
  await recordCrmActivity(staffCtx.serviceSupabase, authResult.data.user.id, staffCtx.identity.user.id, 'user_invited', `User invited as ${role}`, { email, role });
  const invitationLog = await recordCrmCommunication(staffCtx.serviceSupabase, { userId: authResult.data.user.id, direction: 'outbound', channel: 'email', status: 'sent', recipientEmail: email, subject: 'Q account invitation', body: 'A Q account invitation was sent through the authentication provider.', actorId: staffCtx.identity.user.id, metadata: { source: 'crm_invitation', role } });
  if (invitationLog.error) console.error('[Admin] Failed to record invitation communication:', invitationLog.error);
  return res.status(201).json({ id: authResult.data.user.id, email, name, role, invited: true });
}));

async function recordCrmActivity(serviceSupabase: any, userId: string, actorId: string, activityType: string, summary: string, metadata: Record<string, unknown> = {}) {
  await serviceSupabase.from('crm_activities').insert({ user_id: userId, actor_id: actorId, activity_type: activityType, summary, metadata });
}

async function recordCrmCommunication(serviceSupabase: any, communication: {
  userId?: string | null; contactRequestId?: string | null; direction: 'inbound' | 'outbound';
  channel?: 'email' | 'phone' | 'chat' | 'other'; status?: 'logged' | 'draft' | 'sent' | 'failed';
  senderEmail?: string | null; recipientEmail?: string | null; subject?: string | null; body: string;
  actorId?: string | null; metadata?: Record<string, unknown>;
}) {
  return serviceSupabase.from('crm_communications').insert({
    user_id: communication.userId ?? null,
    contact_request_id: communication.contactRequestId ?? null,
    direction: communication.direction,
    channel: communication.channel ?? 'email',
    status: communication.status ?? 'logged',
    sender_email: communication.senderEmail ?? null,
    recipient_email: communication.recipientEmail ?? null,
    subject: communication.subject ?? null,
    body: communication.body,
    actor_id: communication.actorId ?? null,
    metadata: communication.metadata ?? {}
  });
}

adminRouter.get('/crm/users/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res);
  if (!adminCtx) return;
  const { serviceSupabase } = adminCtx;
  const userId = req.params.id;
  const [{ data: authData, error: authError }, profileResult, subscriptionResult, notesResult, tasksResult, paymentsResult, entitlementsResult, activitiesResult, communicationsResult, referralCreditsResult, peerKnowledgeResult] = await Promise.all([
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
    serviceSupabase.from('crm_communications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    serviceSupabase.from('referral_credits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    serviceSupabase.from('peer_knowledge_posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  ]);
  if (authError || !authData?.user) return res.status(404).json({ error: 'Customer not found.' });
  const databaseError = [profileResult, subscriptionResult, notesResult, tasksResult, paymentsResult, entitlementsResult, activitiesResult, communicationsResult, referralCreditsResult].find((result: any) => result.error)?.error;
  if (databaseError) return res.status(500).json({ error: databaseError.message });
  const user = authData.user;
  return res.json({
    identity: { id: user.id, email: user.email, phone: user.phone, signupAt: user.created_at, lastLoginAt: user.last_sign_in_at, emailConfirmedAt: user.email_confirmed_at, metadata: user.user_metadata },
    profile: profileResult.data,
    subscription: subscriptionResult.data,
    notes: notesResult.data ?? [], tasks: tasksResult.data ?? [], payments: paymentsResult.data ?? [],
    entitlements: entitlementsResult.data ?? [], activities: activitiesResult.data ?? [], communications: communicationsResult.data ?? [], referralCredits: referralCreditsResult.data ?? [],
    peerKnowledgeContributions: peerKnowledgeResult.error ? [] : peerKnowledgeResult.data ?? []
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
  const status = ['open', 'in_progress', 'completed', 'cancelled'].includes(req.body?.status) ? req.body.status : 'open';
  const priority = ['low', 'normal', 'high', 'urgent'].includes(req.body?.priority) ? req.body.priority : 'normal';
  const assignedTo = typeof req.body?.assignedTo === 'string' && req.body.assignedTo.trim() ? req.body.assignedTo.trim() : adminCtx.identity.user.id;
  const { data, error } = await adminCtx.serviceSupabase.from('crm_tasks').insert({ user_id: req.params.id, title, description: req.body?.description || null, status, priority, starts_at: req.body?.startAt || null, due_at: req.body?.dueAt || null, assigned_to: assignedTo, created_by: adminCtx.identity.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'task_created', `Task created: ${title}`);
  return res.status(201).json(data);
}));

adminRouter.patch('/crm/users/:id/tasks/:taskId', asyncHandler(async (req, res) => {
  const adminCtx = await requireStaff(req, res); if (!adminCtx) return;
  const updates: Record<string, unknown> = {};
  if (typeof req.body?.title === 'string' && req.body.title.trim()) updates.title = req.body.title.trim();
  if (typeof req.body?.description === 'string') updates.description = req.body.description.trim() || null;
  if (['open', 'in_progress', 'completed', 'cancelled'].includes(req.body?.status)) updates.status = req.body.status;
  if (['low', 'normal', 'high', 'urgent'].includes(req.body?.priority)) updates.priority = req.body.priority;
  if (req.body?.startAt !== undefined) updates.starts_at = req.body.startAt || null;
  if (req.body?.dueAt !== undefined) updates.due_at = req.body.dueAt || null;
  if (req.body?.assignedTo !== undefined) updates.assigned_to = req.body.assignedTo || null;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid task changes supplied.' });
  updates.updated_at = new Date().toISOString();
  const { data, error } = await adminCtx.serviceSupabase.from('crm_tasks').update(updates).eq('id', req.params.taskId).eq('user_id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Unable to update the task.' });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'task_updated', `Task updated: ${data.title}`);
  return res.json(data);
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
  const discountPercent = Number(req.body?.discountPercent || 0);
  const discountCycles = Number(req.body?.discountCycles || 0);
  const hasDiscount = discountPercent > 0 || discountCycles > 0;
  if (hasDiscount && adminCtx.role !== 'partner_admin') return res.status(403).json({ error: 'Only an admin can apply a manual subscription discount.' });
  if (hasDiscount && (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100 || !Number.isInteger(discountCycles) || discountCycles < 1 || discountCycles > 999)) return res.status(400).json({ error: 'Discount must be 1–100% for between 1 and 999 billing cycles.' });
  const { data: product, error } = await adminCtx.serviceSupabase.from('crm_products').select('id, name, description, price_minor, currency, paypal_product_id, paypal_plan_id, billing_interval, active').eq('id', req.body?.productId).maybeSingle();
  if (error || !product) return res.status(404).json({ error: 'Subscription product not found.' });
  if (!product.active || product.billing_interval === 'one_time' || !product.paypal_plan_id) return res.status(400).json({ error: 'This product is not an active PayPal subscription plan.' });
  const appUrl = getCanonicalAppUrl();
  let selectedPlanId = product.paypal_plan_id;
  if (hasDiscount) {
    if (!product.paypal_product_id) return res.status(400).json({ error: 'The product must be synchronized with PayPal before applying a discount.' });
    const regularPrice = (product.price_minor / 100).toFixed(2);
    const discountedPrice = (product.price_minor * (1 - discountPercent / 100) / 100).toFixed(2);
    const trialCycle:any = { frequency: { interval_unit: product.billing_interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'TRIAL', sequence: 1, total_cycles: discountCycles };
    if (discountPercent < 100) trialCycle.pricing_scheme = { fixed_price: { value: discountedPrice, currency_code: product.currency } };
    const customPlan = await paypalRequest('/v1/billing/plans', { method: 'POST', body: JSON.stringify({ product_id: product.paypal_product_id, name: `${product.name} — ${discountPercent}% off × ${discountCycles}`, description: `Admin-authorised discount for ${discountCycles} billing cycle(s)`, status: 'ACTIVE', billing_cycles: [trialCycle, { frequency: { interval_unit: product.billing_interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 2, total_cycles: 0, pricing_scheme: { fixed_price: { value: regularPrice, currency_code: product.currency } } }], payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 } }) });
    selectedPlanId = customPlan.id;
  }
  const subscription = await paypalRequest('/v1/billing/subscriptions', { method: 'POST', headers: { 'PayPal-Request-Id': `q-crm-${req.params.id}-${product.id}-${Date.now()}` }, body: JSON.stringify({ plan_id: selectedPlanId, custom_id: req.params.id, application_context: { brand_name: 'Q Intelligence', user_action: 'SUBSCRIBE_NOW', return_url: `${appUrl}/app?paypal=success`, cancel_url: `${appUrl}/app?paypal=cancel` } }) });
  const approvalUrl = subscription.links?.find((link: any) => link.rel === 'approve')?.href;
  if (!approvalUrl) return res.status(502).json({ error: 'PayPal returned no customer approval link.' });
  await adminCtx.serviceSupabase.from('subscriptions').upsert({ user_id: req.params.id, paypal_subscription_id: subscription.id, paypal_plan_id: selectedPlanId, status: subscription.status || 'APPROVAL_PENDING', current_period_end: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  await recordCrmActivity(adminCtx.serviceSupabase, req.params.id, adminCtx.identity.user.id, 'paypal_subscription_created', `PayPal approval requested for ${product.name}${hasDiscount ? ` with ${discountPercent}% off for ${discountCycles} cycle(s)` : ''}`, { productId: product.id, subscriptionId: subscription.id, discountPercent: hasDiscount ? discountPercent : null, discountCycles: hasDiscount ? discountCycles : null, paypalPlanId: selectedPlanId });
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

adminRouter.post('/crm/products/:id/sync', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase.from('crm_products').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Product not found.' });
  try { return res.json(await syncProductToPayPal(adminCtx.serviceSupabase, data)); }
  catch (syncError: any) {
    console.error('[Admin] PayPal product sync failed:', syncError);
    return res.status(502).json({ error: `PayPal sync failed: ${syncError.message}` });
  }
}));

adminRouter.delete('/crm/products/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;

  const { data: product, error: productError } = await adminCtx.serviceSupabase
    .from('crm_products')
    .select('id,name,active,paypal_plan_id,paypal_founder_plan_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (productError) return res.status(500).json({ error: productError.message });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.active) return res.status(409).json({ error: 'Deactivate this product before deleting it.' });

  const planIds = [product.paypal_plan_id, product.paypal_founder_plan_id].filter(Boolean);
  const [entitlements, subscriptions] = await Promise.all([
    adminCtx.serviceSupabase.from('crm_entitlements').select('id', { count: 'exact', head: true }).eq('product_id', product.id),
    planIds.length
      ? adminCtx.serviceSupabase.from('subscriptions').select('user_id', { count: 'exact', head: true }).in('paypal_plan_id', planIds)
      : Promise.resolve({ count: 0, error: null })
  ]);
  if (entitlements.error || subscriptions.error) return res.status(500).json({ error: 'Unable to verify whether the product is safe to delete.' });
  if ((entitlements.count ?? 0) > 0) return res.status(409).json({ error: 'This product cannot be deleted because it has customer entitlements. Keep it inactive for historical records.' });
  if ((subscriptions.count ?? 0) > 0) return res.status(409).json({ error: 'This product cannot be deleted because PayPal subscriptions reference its plan. Keep it inactive for billing history.' });

  const { error: deleteError } = await adminCtx.serviceSupabase.from('crm_products').delete().eq('id', product.id);
  if (deleteError) {
    if (deleteError.code === '23503') return res.status(409).json({ error: 'This product is still referenced by CRM records and cannot be deleted.' });
    return res.status(500).json({ error: deleteError.message });
  }
  return res.json({ success: true, id: product.id, name: product.name });
}));

adminRouter.post('/contact-requests', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['name', 'email', 'category', 'subject', 'message', 'website'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const category = ['general', 'account', 'billing', 'privacy', 'technical', 'feedback'].includes(req.body?.category) ? req.body.category : 'general';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (req.body?.website) return res.status(202).json({ success: true });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (subject.length < 3 || subject.length > 160) return res.status(400).json({ error: 'Subject must be between 3 and 160 characters.' });
  if (message.length < 10 || message.length > 5000) return res.status(400).json({ error: 'Message must be between 10 and 5,000 characters.' });
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.status(503).json({ error: 'Contact requests are temporarily unavailable.' });
  const recentCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recent = await serviceSupabase.from('contact_requests').select('id').eq('email', email).gte('created_at', recentCutoff).limit(1);
  if (recent.error) return res.status(503).json({ error: 'Unable to check the support queue. Please try again.' });
  if (recent.data?.length) return res.status(429).json({ error: 'A request from this email was recently received. Please wait five minutes before sending another.' });
  const { data, error } = await serviceSupabase.from('contact_requests').insert({ name: name || null, email, category, subject, message }).select('id,created_at').single();
  if (error) return res.status(500).json({ error: 'Unable to save your support request.' });
  const communication = await recordCrmCommunication(serviceSupabase, { contactRequestId: data.id, direction: 'inbound', channel: 'email', senderEmail: email, recipientEmail: process.env.SUPPORT_EMAIL || null, subject, body: message, metadata: { category, name: name || null } });
  if (communication.error) console.error('[Admin] Failed to record inbound CRM communication:', communication.error);
  return res.status(201).json({ success: true, request: data });
}));

adminRouter.get('/contact-requests', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  const { data, error } = await staffCtx.serviceSupabase.from('contact_requests').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: 'Unable to load contact requests.' });
  return res.json(data ?? []);
}));

adminRouter.get('/peer-knowledge', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  const { data, error } = await staffCtx.serviceSupabase.from('peer_knowledge_posts').select('*').order('created_at', { ascending: false }).limit(250);
  if (error) return res.status(500).json({ error: 'Unable to load Peer Knowledge submissions.' });
  return res.json(data ?? []);
}));

adminRouter.patch('/peer-knowledge/:id', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  if (!requireExactObject(req.body, ['status', 'moderationNote'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const status = ['pending', 'approved', 'rejected', 'archived'].includes(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Status must be pending, approved, rejected, or archived.' });
  const moderationNote = typeof req.body?.moderationNote === 'string' ? req.body.moderationNote.trim().slice(0, 1000) : null;
  const updates: Record<string, unknown> = {
    status,
    moderation_note: moderationNote || null,
    moderated_by: staffCtx.identity.user.id,
    moderated_at: new Date().toISOString(),
    published_at: status === 'approved' ? new Date().toISOString() : null
  };
  const { data, error } = await staffCtx.serviceSupabase.from('peer_knowledge_posts').update(updates).eq('id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to moderate this Peer Knowledge submission.' });
  if (!data) return res.status(404).json({ error: 'Peer Knowledge submission not found.' });
  if (data.user_id) await recordCrmActivity(staffCtx.serviceSupabase, data.user_id, staffCtx.identity.user.id, 'peer_knowledge_moderated', `Peer Knowledge submission ${status}`, { postId: data.id, status });
  return res.json(data);
}));

adminRouter.delete('/peer-knowledge/:id', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  const { data, error } = await staffCtx.serviceSupabase.from('peer_knowledge_posts').update({ status: 'archived', moderated_by: staffCtx.identity.user.id, moderated_at: new Date().toISOString(), published_at: null }).eq('id', req.params.id).select('id,status,user_id').maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to archive this Peer Knowledge submission.' });
  if (!data) return res.status(404).json({ error: 'Peer Knowledge submission not found.' });
  if (data.user_id) await recordCrmActivity(staffCtx.serviceSupabase, data.user_id, staffCtx.identity.user.id, 'peer_knowledge_archived', 'Peer Knowledge submission archived', { postId: data.id });
  return res.json({ success: true, id: data.id, status: data.status });
}));

function lifeGuidePayload(body: any, actorId: string, partial = false) {
  const allowed = ['title', 'category', 'summary', 'steps', 'keyContactsOrLinks', 'status'] as const;
  if (!requireExactObject(body, allowed)) return { error: 'Unexpected request fields.' };
  const payload: Record<string, unknown> = { updated_by: actorId };
  if (body.title !== undefined || !partial) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 4 || title.length > 180) return { error: 'Title must be between 4 and 180 characters.' };
    payload.title = title;
  }
  if (body.category !== undefined || !partial) {
    if (!['healthcare', 'rights', 'social', 'mental_health', 'career', 'housing'].includes(body.category)) return { error: 'Choose a valid Life Guide category.' };
    payload.category = body.category;
  }
  if (body.summary !== undefined || !partial) {
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (summary.length < 10 || summary.length > 500) return { error: 'Summary must be between 10 and 500 characters.' };
    payload.summary = summary;
  }
  if (body.steps !== undefined || !partial) {
    if (!Array.isArray(body.steps)) return { error: 'Steps must be an array.' };
    const steps = body.steps.map((step: any, index: number) => ({
      id: typeof step?.id === 'string' && step.id.trim() ? step.id.trim().slice(0, 80) : `s${index + 1}`,
      text: typeof step?.text === 'string' ? step.text.trim().slice(0, 1000) : '',
      completed: false
    })).filter((step: any) => step.text).slice(0, 20);
    if (steps.length < 2) return { error: 'Add at least two Life Guide steps.' };
    payload.steps = steps;
  }
  if (body.keyContactsOrLinks !== undefined) {
    if (!Array.isArray(body.keyContactsOrLinks)) return { error: 'Resources must be an array.' };
    payload.key_contacts_or_links = body.keyContactsOrLinks.map((link: any) => ({
      name: typeof link?.name === 'string' ? link.name.trim().slice(0, 100) : '',
      detail: typeof link?.detail === 'string' ? link.detail.trim().slice(0, 240) : ''
    })).filter((link: any) => link.name && link.detail).slice(0, 8);
  }
  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) return { error: 'Status must be draft, published, or archived.' };
    payload.status = body.status;
    payload.published_at = body.status === 'published' ? new Date().toISOString() : null;
  } else if (!partial) {
    payload.status = 'draft';
  }
  if (!partial) payload.created_by = actorId;
  return { payload };
}

adminRouter.get('/life-guides', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  const { data, error } = await staffCtx.serviceSupabase.from('life_guides').select('*').order('updated_at', { ascending: false }).limit(250);
  if (error) return res.status(500).json({ error: 'Unable to load Life Guides.' });
  return res.json(data ?? []);
}));

adminRouter.post('/life-guides', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const parsed = lifeGuidePayload(req.body, adminCtx.identity.user.id);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { data, error } = await adminCtx.serviceSupabase.from('life_guides').insert(parsed.payload).select('*').single();
  if (error) return res.status(500).json({ error: 'Unable to create Life Guide.' });
  return res.status(201).json(data);
}));

adminRouter.patch('/life-guides/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const parsed = lifeGuidePayload(req.body, adminCtx.identity.user.id, true);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { data, error } = await adminCtx.serviceSupabase.from('life_guides').update(parsed.payload).eq('id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to update Life Guide.' });
  if (!data) return res.status(404).json({ error: 'Life Guide not found.' });
  return res.json(data);
}));

adminRouter.delete('/life-guides/:id', asyncHandler(async (req, res) => {
  const adminCtx = await requireAdmin(req, res);
  if (!adminCtx) return;
  const { data, error } = await adminCtx.serviceSupabase.from('life_guides').update({ status: 'archived', published_at: null, updated_by: adminCtx.identity.user.id }).eq('id', req.params.id).select('id,status').maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to archive Life Guide.' });
  if (!data) return res.status(404).json({ error: 'Life Guide not found.' });
  return res.json({ success: true, id: data.id, status: data.status });
}));

adminRouter.get('/communications', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  const requestedLimit = Number.parseInt(String(req.query.limit ?? '250'), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 250;
  const { data, error } = await staffCtx.serviceSupabase.from('crm_communications').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return res.status(500).json({ error: 'Unable to load CRM communications.' });
  return res.json(data ?? []);
}));

adminRouter.post('/communications', asyncHandler(async (req, res) => {
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  if (!requireExactObject(req.body, ['userId', 'contactRequestId', 'channel', 'status', 'senderEmail', 'recipientEmail', 'subject', 'body'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const channel = req.body?.channel;
  const status = req.body?.status;
  if (!body || body.length > 5000) return res.status(400).json({ error: 'Message body must be between 1 and 5,000 characters.' });
  if (!['email', 'phone', 'chat', 'other'].includes(channel)) return res.status(400).json({ error: 'Unsupported communication channel.' });
  if (!['logged', 'draft', 'sent', 'failed'].includes(status)) return res.status(400).json({ error: 'Unsupported communication status.' });
  const result = await recordCrmCommunication(staffCtx.serviceSupabase, { userId: req.body?.userId || null, contactRequestId: req.body?.contactRequestId || null, direction: 'outbound', channel, status, senderEmail: req.body?.senderEmail || null, recipientEmail: req.body?.recipientEmail || null, subject: req.body?.subject || null, body, actorId: staffCtx.identity.user.id, metadata: { manuallyLogged: true } });
  if (result.error) return res.status(500).json({ error: 'Unable to log the outbound communication.' });
  return res.status(201).json(result.data?.[0] ?? { success: true });
}));

adminRouter.patch('/contact-requests/:id', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['status', 'responseText'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  const staffCtx = await requireStaff(req, res);
  if (!staffCtx) return;
  const status = ['new', 'in_progress', 'answered', 'closed'].includes(req.body?.status) ? req.body.status : null;
  const responseText = typeof req.body?.responseText === 'string' ? req.body.responseText.trim().slice(0, 5000) : undefined;
  if (!status && responseText === undefined) return res.status(400).json({ error: 'No valid support-request changes supplied.' });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (responseText !== undefined) updates.response_text = responseText || null;
  if (status === 'answered') {
    updates.answered_by = staffCtx.identity.user.id;
    updates.answered_at = new Date().toISOString();
  }
  const { data, error } = await staffCtx.serviceSupabase.from('contact_requests').update(updates).eq('id', req.params.id).select('*').single();
  if (error) return res.status(500).json({ error: 'Unable to update the contact request.' });
  if (status === 'answered' && responseText) {
    const existing = await staffCtx.serviceSupabase.from('crm_communications').select('id').eq('contact_request_id', req.params.id).eq('direction', 'outbound').eq('body', responseText).limit(1);
    if (!existing.error && !existing.data?.length) {
      const logged = await recordCrmCommunication(staffCtx.serviceSupabase, { contactRequestId: req.params.id, direction: 'outbound', channel: 'email', status: 'sent', senderEmail: process.env.SUPPORT_EMAIL || null, recipientEmail: data.email, subject: `Re: ${data.subject}`, body: responseText, actorId: staffCtx.identity.user.id, metadata: { source: 'contact_request_reply' } });
      if (logged.error) console.error('[Admin] Failed to record outbound CRM communication:', logged.error);
    }
  }
  return res.json(data);
}));

adminRouter.post('/password-reset-requests', asyncHandler(async (req, res) => {
  try {
    if (!requireExactObject(req.body, ['email', 'message'])) return res.status(400).json({ error: 'Unexpected request fields.' });
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!email) {
      return res.status(400).json({ error: 'An email address is required.' });
    }

    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) {
      return res.status(503).json({ error: 'Password reset requests are temporarily unavailable. Please contact Q support.' });
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
      return sendOpaqueError(req, res, 500, 'Failed to save the password reset request.', 'Admin Password Reset Request', error);
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
    return sendOpaqueError(req, res, 500, 'Failed to submit request.', 'Admin Password Reset Request', error);
  }
}));

adminRouter.get('/password-reset-requests', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireStaff(req, res);
    if (!adminCtx) return;

    const { data, error } = await adminCtx.serviceSupabase
      .from('password_reset_requests')
      .select('id, email, message, created_at, status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin] password_reset_requests select failed:', error);
      return sendOpaqueError(req, res, 500, 'Failed to retrieve reset requests.', 'Admin List Password Reset Requests', error);
    }

    return res.json((data ?? []).map(mapPasswordResetRequest));
  } catch (error: any) {
    return sendOpaqueError(req, res, 500, 'Failed to retrieve reset requests.', 'Admin List Password Reset Requests', error);
  }
}));

adminRouter.post('/password-reset-requests/:id/reset', asyncHandler(async (req, res) => {
  try {
    const adminCtx = await requireStaff(req, res);
    if (!adminCtx) return;
    const { serviceSupabase } = adminCtx;

    const { data: requestRow, error: requestError } = await serviceSupabase
      .from('password_reset_requests')
      .select('id, email, message, created_at, status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (requestError) {
      console.error('[Admin] password_reset_requests lookup failed:', requestError);
      return sendOpaqueError(req, res, 500, 'Password reset request lookup failed.', 'Admin Password Reset Lookup', requestError);
    }

    if (!requestRow) {
      return res.status(404).json({ error: 'Password reset request not found.' });
    }

    const request = mapPasswordResetRequest(requestRow);
    const user = await findAuthUserByEmail(serviceSupabase, request.email);
    if (!user) {
      await serviceSupabase
        .from('password_reset_requests')
        .update({ status: 'failed' })
        .eq('id', request.id);
      return res.status(404).json({ error: 'No Q account was found for this reset request email.' });
    }

    const issued = await issueTemporaryPassword(serviceSupabase, user, adminCtx.identity.user.id, { source: 'password_reset_request', requestId: request.id });

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
      temporaryPassword: issued.temporaryPassword,
      email: user.email,
      userId: user.id,
      request: updatedRequest ? mapPasswordResetRequest(updatedRequest) : { ...request, status: 'reset' }
    });
  } catch (error: any) {
    return sendOpaqueError(req, res, 500, 'Unable to issue the temporary password.', 'Admin Temporary Password', error);
  }
}));

adminRouter.post('/direct-password-reset', asyncHandler(async (req, res) => {
  try {
    if (!requireExactObject(req.body, ['email'])) return res.status(400).json({ error: 'Unexpected request fields.' });
    const staffCtx = await requireStaff(req, res);
    if (!staffCtx) return;
    const { serviceSupabase } = staffCtx;

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const user = await findAuthUserByEmail(serviceSupabase, email);
    if (!user) return res.status(404).json({ error: 'No Q account was found for that email address.' });

    const issued = await issueTemporaryPassword(serviceSupabase, user, staffCtx.identity.user.id, { source: 'direct_password_reset' });
    return res.json({ success: true, email: user.email, userId: user.id, temporaryPassword: issued.temporaryPassword });
  } catch (error: any) {
    return sendOpaqueError(req, res, 500, 'Unable to issue the temporary password.', 'Admin Direct Temporary Password', error);
  }
}));

adminRouter.post('/crm/users/:id/temporary-password', asyncHandler(async (req, res) => {
  try {
    if (!requireExactObject(req.body, [])) return res.status(400).json({ error: 'Unexpected request fields.' });
    const staffCtx = await requireStaff(req, res);
    if (!staffCtx) return;

    const { data: authData, error: authError } = await staffCtx.serviceSupabase.auth.admin.getUserById(req.params.id);
    if (authError || !authData?.user) return res.status(404).json({ error: 'Customer not found.' });

    const issued = await issueTemporaryPassword(staffCtx.serviceSupabase, authData.user, staffCtx.identity.user.id, { source: 'crm_customer_record' });
    return res.json({ success: true, email: authData.user.email, userId: authData.user.id, temporaryPassword: issued.temporaryPassword });
  } catch (error: any) {
    return sendOpaqueError(req, res, 500, 'Unable to issue the temporary password.', 'CRM Temporary Password', error);
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
    return sendOpaqueError(req, res, 500, 'Could not fetch provider metrics.', 'Admin Provider Insights', error);
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
    return sendOpaqueError(req, res, 500, 'Aggregate export failed privacy validation.', 'Admin Aggregate Export', error);
  }
}));
