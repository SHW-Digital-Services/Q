import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getAuthenticatedUser, getRequestId } from './middleware.js';

export type StaffCapability =
  | 'crm.read' | 'crm.sensitive' | 'crm.write' | 'billing.read' | 'billing.write'
  | 'support.read' | 'support.write' | 'security.admin' | 'analytics.export';

const STAFF_DEFAULTS = new Set<StaffCapability>(['crm.read', 'crm.write', 'support.read', 'support.write', 'billing.read']);
const SENSITIVE_CAPABILITIES = new Set<StaffCapability>(['billing.write', 'security.admin', 'analytics.export']);

function decodeJwtPayload(authorization?: string): Record<string, unknown> | null {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function hasRecentAal2(request: Request, maximumAgeSeconds = Number(process.env.PRIVILEGED_SESSION_MAX_AGE_SECONDS ?? 900)) {
  const payload = decodeJwtPayload(request.headers.authorization);
  const issuedAt = Number(payload?.iat);
  return payload?.aal === 'aal2' && Number.isFinite(issuedAt) && Date.now() / 1000 - issuedAt <= maximumAgeSeconds;
}

export function requireExactObject(body: unknown, allowedKeys: readonly string[]) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body).every((key) => allowedKeys.includes(key));
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function boundedString(value: unknown, maximum: number, required = false): string | null {
  if (value === undefined || value === null) return required ? null : '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > maximum) return null;
  return trimmed;
}

export async function writeSecurityEvent(db: any, request: Request, event: {
  actorId?: string; subjectId?: string; action: string; outcome: 'allowed' | 'denied' | 'failed'; metadata?: Record<string, unknown>;
}) {
  const safeMetadata = Object.fromEntries(Object.entries(event.metadata ?? {}).filter(([key]) => !/content|message|token|password|email/i.test(key)));
  const { error } = await db.from('security_events').insert({
    actor_id: event.actorId ?? null,
    subject_id: event.subjectId ?? null,
    action: event.action,
    outcome: event.outcome,
    request_id: getRequestId(request),
    metadata: safeMetadata
  });
  if (error) console.error(`[Security Audit] requestId=${getRequestId(request)} action=${event.action}`, error.message);
}

export function createRateLimitMiddleware(getServiceDb: () => any) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const routeClass = request.path.includes('password-reset') ? 'password-reset'
      : request.path.includes('contact-requests') ? 'contact'
      : request.path.includes('paypal') ? 'billing'
      : request.path.includes('referral') ? 'referral'
      : request.path.includes('admin') ? 'admin' : 'api';
    const limits: Record<string, [number, number]> = {
      'password-reset': [5, 900], contact: [10, 900], billing: [30, 60], referral: [30, 60], admin: [120, 60], api: [120, 60]
    };
    const db = getServiceDb();
    if (!db) return next();
    const [maximum, seconds] = limits[routeClass];
    const subject = createHash('sha256').update(`${request.ip}|${request.headers.authorization ? 'authenticated' : 'anonymous'}`).digest('hex').slice(0, 32);
    const result = await db.rpc('consume_api_rate_limit', { bucket_key: `${routeClass}:${subject}`, window_seconds: seconds, maximum_requests: maximum });
    if (result.error) {
      console.error(`[Rate Limit] requestId=${getRequestId(request)}`, result.error.message);
      if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') return next();
      return response.status(503).json({ error: 'Request protection is temporarily unavailable.', requestId: getRequestId(request) });
    }
    const decision = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!decision?.allowed) {
      response.setHeader('Retry-After', String(decision?.retry_after_seconds ?? seconds));
      return response.status(429).json({ error: 'Too many requests. Please try again later.', requestId: getRequestId(request) });
    }
    next();
  };
}

function permissionFor(request: Request): StaffCapability | null {
  const path = request.path;
  if (path === '/me') return null;
  if (path === '/site-settings/launch' && request.method === 'GET') return null;
  if (path === '/contact-requests' && request.method === 'POST') return null;
  if (path === '/password-reset-requests' && request.method === 'POST') return null;
  if (path === '/data-moat-export') return 'analytics.export';
  if (path.startsWith('/staff') || path.includes('/role') || path.includes('password-reset')) return 'security.admin';
  if (path.includes('payments') || path.includes('paypal-subscriptions') || path.includes('referral-credits')) return request.method === 'GET' ? 'billing.read' : 'billing.write';
  if (path.startsWith('/crm/products')) return request.method === 'GET' ? 'billing.read' : 'billing.write';
  if (path.startsWith('/contact-requests')) return request.method === 'GET' ? 'support.read' : 'support.write';
  if (/^\/crm\/users\/[^/]+$/.test(path) && request.method === 'GET') return 'crm.sensitive';
  if (path.startsWith('/crm/')) return request.method === 'GET' ? 'crm.read' : 'crm.write';
  if (path.startsWith('/provider-insights')) return 'analytics.export';
  if (path.startsWith('/site-settings')) return 'security.admin';
  return 'security.admin';
}

export function createAdminSecurityMiddleware(getServiceDb: () => any) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const capability = permissionFor(request);
    if (!capability) return next();
    const identity = await getAuthenticatedUser(request);
    if (!identity) return response.status(401).json({ error: 'Authentication required.' });
    const db = getServiceDb();
    if (!db) return response.status(503).json({ error: 'Administrative access is temporarily unavailable.' });
    const { data: profile, error } = await db.from('profiles').select('role,staff_permissions').eq('id', identity.user.id).maybeSingle();
    const permissions = new Set<StaffCapability>(profile?.staff_permissions ?? []);
    const allowed = !error && (profile?.role === 'partner_admin' || (profile?.role === 'staff' && (permissions.size ? permissions.has(capability) : STAFF_DEFAULTS.has(capability))));
    if (!allowed) {
      await writeSecurityEvent(db, request, { actorId: identity.user.id, action: capability, outcome: 'denied' });
      return response.status(403).json({ error: 'This staff permission is required.' });
    }
    if (SENSITIVE_CAPABILITIES.has(capability) && !hasRecentAal2(request)) {
      await writeSecurityEvent(db, request, { actorId: identity.user.id, action: capability, outcome: 'denied', metadata: { reason: 'aal2_required' } });
      return response.status(403).json({ error: 'Recent multi-factor authentication is required.', code: 'AAL2_REQUIRED' });
    }
    await writeSecurityEvent(db, request, { actorId: identity.user.id, action: capability, outcome: 'allowed', metadata: { method: request.method, path: request.path } });
    next();
  };
}
