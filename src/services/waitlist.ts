import { getSupabaseClient } from './supabase';

export type WaitlistResult = 'joined' | 'already_joined';

export async function joinWaitlist(name: string, email: string): Promise<WaitlistResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Waitlist is not configured yet.');

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.from('waitlist').insert({
    name: normalizedName,
    email: normalizedEmail
  });

  if (!error) return 'joined';
  if (error.code === '23505') return 'already_joined';
  throw error;
}
