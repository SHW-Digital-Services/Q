import { createHash, randomBytes } from 'node:crypto';

export const MAX_BREVO_REQUEST_BYTES = 256 * 1024;
const sensitiveKeys = /^(?:authorization|cookie|set[-_]?cookie|password|passwd|secret|token|access[-_]?token|refresh[-_]?token|api[-_]?key|client[-_]?secret|recovery[-_]?code)$/i;

export function hashWebhookToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
export function newWebhookToken() {
  const token = `q_brevo_${randomBytes(32).toString('base64url')}`;
  return { token, token_hash: hashWebhookToken(token), token_prefix: token.slice(0, 12) };
}
export function newIntegrationAddress() {
  return `${randomBytes(12).toString('hex')}@q-ai.online`;
}
function ordered(value: any, redact: boolean, depth = 0): any {
  if (depth > 20) throw new Error('Event payload nesting exceeds 20 levels.');
  if (Array.isArray(value)) return value.map((item) => ordered(item, redact, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, redact && sensitiveKeys.test(key) ? '[REDACTED]' : ordered(value[key], redact, depth + 1)]));
  return value;
}
export function normaliseBrevoEvents(body: unknown) {
  if (Buffer.byteLength(JSON.stringify(body) ?? '', 'utf8') > MAX_BREVO_REQUEST_BYTES) throw new Error('Webhook requests must be no larger than 256 KB.');
  const events = Array.isArray(body) ? body : [body];
  if (events.length < 1 || events.length > 100) throw new Error('Send one JSON event or a batch of 1–100 events.');
  return events.map((event) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Each webhook event must be a JSON object.');
    if (typeof event.event !== 'string' || !event.event.trim() || event.event.trim().length > 120) throw new Error('Each Brevo event must have an event name (1–120 characters).');
    if (event.email != null && (typeof event.email !== 'string' || event.email.length > 320)) throw new Error('Event email must be a string of 320 characters or fewer.');
    const canonical = JSON.stringify(ordered(event, false));
    if (Buffer.byteLength(canonical, 'utf8') > 32 * 1024) throw new Error('Individual events must be no larger than 32 KB.');
    return {
      // Brevo's id can be a webhook ID shared by many events, not a delivery ID.
      dedupe_key: createHash('sha256').update(canonical, 'utf8').digest('hex'),
      event_type: event.event.trim(), email: event.email?.trim() || null,
      payload: ordered(event, true)
    };
  });
}
