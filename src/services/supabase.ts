import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthUser } from '../types';

let supabaseInstance: SupabaseClient | null = null;

export function isAdminUser(user: User | null | undefined) {
  const adminFlag = user?.user_metadata?.isAdmin ?? user?.app_metadata?.isAdmin ?? false;
  return Boolean(adminFlag);
}

// Helper to check if Supabase URL and key are provided
export function getSupabaseEnvConfig() {
  const env = (import.meta as any).env || {};
  const url = env.VITE_SUPABASE_URL || '';
  const key = env.VITE_SUPABASE_ANON_KEY || '';
  const isConfigured = Boolean(url && key && url.includes('supabase.co') && !url.includes('your-project-id'));
  return { url, key, isConfigured };
}

// Lazy initialization of Supabase client
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, key, isConfigured } = getSupabaseEnvConfig();
  if (!isConfigured || !url || !key) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize secure account service:', err);
    return null;
  }
}

// Map Supabase User to App AuthUser
export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Member',
    avatarUrl: user.user_metadata?.avatar_url,
    createdAt: user.created_at
  };
}
