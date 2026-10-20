export type WaitlistResult = 'joined' | 'already_joined';

export async function joinWaitlist(name: string, email: string, adultConfirmed: boolean): Promise<WaitlistResult> {
  const response = await fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), adultConfirmed })
  });
  let result: { status?: string; error?: string } = {};
  try {
    result = await response.json();
  } catch {
    throw new Error('The waitlist is temporarily unavailable.');
  }
  if (response.ok && (result.status === 'joined' || result.status === 'already_joined')) return result.status;
  throw new Error(result.error || 'The waitlist is temporarily unavailable.');
}
