import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error('SUPABASE_URL missing');
if (!anon && !serviceRole) throw new Error('Provide SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');

// Prefer service role on server for write-heavy operations
const supabaseKey = serviceRole || anon;
const supabase = createClient(url, supabaseKey as string);

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
