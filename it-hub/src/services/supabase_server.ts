import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url) throw new Error('SUPABASE_URL missing');
if (!secretKey && !serviceRole) throw new Error('Provide SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');

// This server needs privileged database access; never fall back to a public key.
const supabase = createClient(url, (secretKey || serviceRole) as string, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export async function logEvent(type: string, payload: any) {
  const { data, error } = await supabase
    .from('it_hub_events')
    .insert([{ type, payload }]);
  if (error) throw error;
  return data;
}

export async function getRecentEvents(limit = 50) {
  const { data, error } = await supabase
    .from('it_hub_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
