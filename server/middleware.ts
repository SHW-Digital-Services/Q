import type { Request } from 'express';
import { createClient } from '@supabase/supabase-js';

export async function getAuthenticatedUser(request: Request) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const authorization = request.headers.authorization;

  if (!supabaseUrl || !supabaseAnonKey || !authorization) return null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return null;
  return { authClient, user: data.user };
}
