import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthUser } from '../types';

let supabaseInstance: SupabaseClient | null = null;
export const crmMicrosoftSsoPendingKey = 'q.crm.microsoft.sso.pending';
export const crmMicrosoftSsoDeniedKey = 'q.crm.microsoft.sso.denied';

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

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Secure account access is temporarily unavailable. Please contact Q support.');
  }

  const redirectTo = new URL('/app', window.location.origin).toString();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });

  if (error) throw error;
}

export async function signInWithMicrosoftForCrm() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Secure staff access is temporarily unavailable. Please contact Q support.');
  }

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(crmMicrosoftSsoPendingKey, '1');
    window.sessionStorage.removeItem(crmMicrosoftSsoDeniedKey);
  }
  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const crmOrigin = isLocalDevelopment ? window.location.origin : 'https://www.q-ai.online';
  const redirectTo = new URL('/crm', crmOrigin).toString();
  const { error } = await supabase.auth.signInWithSSO({
    domain: 'q-ai.online',
    options: { redirectTo }
  });

  if (error) {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(crmMicrosoftSsoPendingKey);
    throw error;
  }
}

// Map Supabase User to App AuthUser
export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name:
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'Member',
    avatarUrl: user.user_metadata?.avatar_url,
    createdAt: user.created_at
  };
}
