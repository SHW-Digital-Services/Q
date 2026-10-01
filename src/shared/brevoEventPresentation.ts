type EventInfo = { title: string; explanation: string; group: string; attention?: boolean };
const definitions: Record<string, EventInfo> = {
  request: { title: 'Message queued', explanation: 'Brevo accepted a request to send this message.', group: 'delivery' },
  sent: { title: 'Message sent', explanation: 'Brevo reports that the message was sent.', group: 'delivery' },
  delivered: { title: 'Message delivered', explanation: 'The receiving service accepted the message. This does not confirm it was read.', group: 'delivery' },
  opened: { title: 'Message opened', explanation: 'Brevo recorded an opening. Privacy tools and automated scanners can affect this signal.', group: 'engagement' },
  unique_opened: { title: 'First recorded opening', explanation: 'Brevo recorded the first opening for this message and recipient.', group: 'engagement' },
  proxy_open: { title: 'Opening through a privacy proxy', explanation: 'An email privacy service loaded the tracking image; this may not be a human opening.', group: 'engagement' },
  unique_proxy_open: { title: 'First privacy-proxy opening', explanation: 'Brevo recorded the first tracking-image load through a privacy service.', group: 'engagement' },
  click: { title: 'Link clicked', explanation: 'Brevo recorded a link click. Automated scanners can also generate clicks.', group: 'engagement' },
  soft_bounce: { title: 'Temporary delivery failure', explanation: 'Delivery failed temporarily. Check the reported reason before deciding what to do.', group: 'problems', attention: true },
  hard_bounce: { title: 'Permanent delivery failure', explanation: 'Brevo reports a permanent delivery failure. Review the recipient and reported reason.', group: 'problems', attention: true },
  blocked: { title: 'Message blocked', explanation: 'Brevo blocked this message. Open the details to check the reported reason.', group: 'problems', attention: true },
  invalid: { title: 'Invalid recipient', explanation: 'Brevo reports that the recipient address is invalid.', group: 'problems', attention: true },
  deferred: { title: 'Delivery delayed', explanation: 'Delivery has been postponed. Review the reported reason and later delivery events.', group: 'problems', attention: true },
  error: { title: 'Sending error', explanation: 'Brevo reported an error. Open the details to check the supplied reason.', group: 'problems', attention: true },
  spam: { title: 'Spam complaint', explanation: 'Brevo recorded a spam complaint. Review the contact’s communication preferences in Brevo.', group: 'problems', attention: true },
  unsubscribed: { title: 'Unsubscribe reported', explanation: 'Brevo reported an unsubscribe. Reviewing this event does not change consent or subscriptions in Q.', group: 'consent', attention: true },
  subscribe: { title: 'Subscription reported', explanation: 'Brevo reported a subscription event. Check its context before changing contact preferences.', group: 'consent' },
  list_addition: { title: 'Contact added to a list', explanation: 'Brevo reported that a contact was added to a list.', group: 'contacts' },
  contact_updated: { title: 'Contact updated', explanation: 'Brevo reported a contact update. The event does not automatically update Q customer records.', group: 'contacts' },
  contact_deleted: { title: 'Contact deleted in Brevo', explanation: 'Brevo reported a deleted contact. This does not delete the person’s Q account.', group: 'contacts' },
};
const aliases: Record<string, string> = { clicked: 'click', unsubscribe: 'unsubscribed', list_add: 'list_addition', hardbounce: 'hard_bounce', softbounce: 'soft_bounce', uniqueopened: 'unique_opened', listaddition: 'list_addition', contactupdated: 'contact_updated', contactdeleted: 'contact_deleted' };
const canonical = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[ -]/g, '_').toLowerCase();

export const brevoEventGroups = [
  { value: 'all', label: 'All event types' }, { value: 'problems', label: 'Delivery problems & complaints' },
  { value: 'delivery', label: 'Sending & delivery' }, { value: 'engagement', label: 'Opens & clicks' },
  { value: 'contacts', label: 'Contact changes' }, { value: 'consent', label: 'Subscriptions & consent' },
] as const;

export function brevoEventInfo(eventType: string): EventInfo {
  const key = canonical(eventType);
  return definitions[aliases[key] || key] || { title: eventType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, char => char.toUpperCase()), explanation: 'Brevo sent this event to Q. Open its details to understand the supplied information.', group: 'other' };
}

export function brevoGroupTypes(group: string): string[] {
  const result = new Set<string>();
  for (const [key, info] of Object.entries(definitions)) if (info.group === group) {
    result.add(key);
    result.add(key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()));
    for (const [alias, target] of Object.entries(aliases)) if (target === key) result.add(alias);
  }
  return [...result];
}

export function brevoReadableDetails(payload: unknown): { label: string; value: string }[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const source = payload as Record<string, unknown>;
  const fields: { label: string; value: string }[] = [];
  for (const [label, keys] of [
    ['Subject', ['subject']], ['Reported reason', ['reason', 'description', 'error']],
    ['Message reference', ['message-id', 'messageId', 'message_id']],
    ['Campaign reference', ['campaign_id', 'campaignId']], ['List reference', ['list_id', 'listId']],
  ] as [string, string[]][]) {
    const value = keys.map(key => source[key]).find(value => (typeof value === 'string' && value.trim()) || typeof value === 'number');
    if (value !== undefined) fields.push({ label, value: String(value).slice(0, 500) });
  }
  const timestamp = Number(source.ts_event);
  if (source.ts_event !== undefined && Number.isFinite(timestamp) && timestamp > 0) {
    const date = new Date(timestamp * 1000);
    if (!Number.isNaN(date.getTime())) fields.push({ label: 'Occurred at (UTC)', value: date.toISOString() });
  }
  return fields;
}
