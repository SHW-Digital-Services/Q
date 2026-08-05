import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

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
