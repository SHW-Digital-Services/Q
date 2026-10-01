import { createHmac, timingSafeEqual } from 'node:crypto';
import { onlineRole, type OnlineRole } from '../src/shared/onlinePresence.js';

export const PRESENCE_TICKET_LIFETIME_MS = 150_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ticket = { user_id: string; role: OnlineRole; issued_at: number };

// Derive a key for this feature; never expose a Supabase credential to clients.
export function presenceSigningKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('q-online-presence-v1').digest();
}

export function signPresenceTicket(userId: string, role: OnlineRole, key: Buffer, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ user_id: userId, role, issued_at: now })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

export function verifyPresenceTicket(value: unknown, key: Buffer, now = Date.now()): Ticket | null {
  if (typeof value !== 'string' || value.length > 600) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const actual = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', key).update(payload).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!uuid.test(ticket.user_id) || !['customer', 'staff', 'admin'].includes(ticket.role) ||
      !Number.isFinite(ticket.issued_at) || ticket.issued_at > now || now - ticket.issued_at >= PRESENCE_TICKET_LIFETIME_MS) return null;
    return ticket;
  } catch { return null; }
}

export function presenceDisplayName(profile: { preferred_name?: string | null; role: string }): string {
  return profile.preferred_name?.trim().slice(0, 120) || (onlineRole(profile.role) === 'customer' ? 'Signed-in customer' : onlineRole(profile.role) === 'staff' ? 'Staff member' : 'Admin');
}
