import { getSupabaseClient } from './supabase';

export async function premiumRequest(path: string, method = 'GET', body?: unknown, expectedUser?: string) {
  const client = getSupabaseClient();
  const { data } = await client?.auth.getSession() ?? { data: { session: null } };
  if (!data.session || (expectedUser && data.session.user.id !== expectedUser)) throw new Error('Your session changed. Please sign in again.');
  const response = await fetch(`/api/premium/${path}`, { method, cache:'no-store', headers: { Authorization:`Bearer ${data.session.access_token}`, 'Content-Type':'application/json' }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to complete this request.');
  return result;
}
