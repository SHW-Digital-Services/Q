import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export function getRequestId(request: Request): string {
  const existing = request.header('x-request-id');
  return existing && /^[A-Za-z0-9._-]{1,100}$/.test(existing) ? existing : randomUUID();
}

export function sendOpaqueError(
  request: Request,
  response: Response,
  status: number,
  publicMessage: string,
  context: string,
  error?: unknown
) {
  const requestId = getRequestId(request);
  response.setHeader('X-Request-Id', requestId);
  console.error(`[${context}] requestId=${requestId}`, error instanceof Error ? error.message : error);
  return response.status(status).json({ error: publicMessage, requestId });
}

export function getCanonicalAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
      throw new Error('APP_URL is required in production.');
    }
    return 'http://localhost:3000';
  }

  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('APP_URL must be an absolute HTTP(S) origin without credentials, query, or fragment.');
  }
  if ((process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') && url.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production.');
  }
  return url.origin;
}

export async function getAuthenticatedUser(request: Request) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.authorization;

  if (!supabaseUrl || !supabaseAnonKey || !authorization) return null;

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } }
    });
    const { data, error } = await authClient.auth.getUser();
    if (error || !data.user) return null;
    return { authClient, user: data.user };
  } catch (err) {
    console.warn('[Middleware] getAuthenticatedUser error:', err);
    return null;
  }
}
