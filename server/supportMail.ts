import { mailConfig, mailId, mailRecipients, ZohoMailClient } from './zohoMail.js';

// Notifications use the existing office mailbox. Only a generic notice and link
// leave Q; the request subject, body and internal notes are never emailed.
export async function sendSupportEmail(email: string, link: string, fetcher: typeof fetch = fetch): Promise<void> {
  const config = mailConfig();
  if (!config) throw new Error('SUPPORT_MAIL_UNAVAILABLE');
  const mailbox = 'office@q-ai.online';
  const client = new ZohoMailClient(config, { owner: mailbox, access: '', refresh: config.refreshToken, tokenExpires: 0, expires: Number.MAX_SAFE_INTEGER }, () => {}, fetcher);
  const accounts = await client.json('/accounts');
  const matching = (Array.isArray(accounts) ? accounts : []).filter(a => String(a.primaryEmailAddress || a.mailboxAddress || '').toLowerCase() === mailbox);
  if (matching.length !== 1) throw new Error('SUPPORT_MAIL_UNAVAILABLE');
  await client.json(`/accounts/${mailId(String(matching[0].accountId))}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromAddress: mailbox, toAddress: mailRecipients(email, true), subject: 'Your Q support request',
      content: `There is an update or access link for your Q support request.\n\nOpen Q to read your conversation:\n${link}\n\nKeep this link private. Email access links expire after 24 hours.\n\nQ product support is not an emergency service.`, mailFormat: 'plaintext', encoding: 'UTF-8' })
  });
}
