import { getSupabaseClient } from './supabase';

export async function supportApi<T>(path: string, options: { method?: string; body?: unknown; guest?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string,string> = {};
  if (!options.guest) {
    const client = getSupabaseClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session) throw new Error('Sign in to use Q support.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/support${path}`, { method: options.method || 'GET', headers, credentials: 'same-origin', cache: 'no-store', signal: options.signal, body: options.body !== undefined ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this support request.');
  return data as T;
}
