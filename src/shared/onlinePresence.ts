export type OnlineRole = 'customer' | 'staff' | 'admin';
export const presenceTopics = { customer: 'online-users', staff: 'online-staff', admin: 'online-admins' } as const;
export type OnlineUser = { user_id: string; display_name: string; role: OnlineRole };
export type PresenceAccess = { user_id: string; role: OnlineRole; ticket: string; publishTopic: string; readTopics: string[] };

export function onlineRole(role: string): OnlineRole | null {
  if (role === 'user' || role === 'beta_tester') return 'customer';
  if (role === 'staff') return 'staff';
  if (role === 'partner_admin') return 'admin';
  return null;
}

export function readableTopics(role: OnlineRole): string[] {
  return role === 'admin' ? Object.values(presenceTopics) : role === 'staff' ? [presenceTopics.customer] : [];
}

export function presenceTickets(states: Record<string, unknown>[]): string[] {
  const tickets = new Set<string>();
  for (const state of states) for (const entries of Object.values(state)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) if (typeof entry?.ticket === 'string' && entry.ticket.length <= 600) tickets.add(entry.ticket);
  }
  return [...tickets];
}
