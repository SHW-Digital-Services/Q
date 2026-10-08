import { getSupabaseClient } from './supabase';

export async function feedbackApi<T>(path: string, options: { public?: boolean; method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string,string> = {};
  if (!options.public) {
    const client = getSupabaseClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session) throw new Error('Sign in to use Q feedback.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/feedback${path}`, { method: options.method || 'GET', headers, cache: 'no-store', credentials: 'same-origin', signal: options.signal, body: options.body !== undefined ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this feedback request.');
  return data as T;
}
