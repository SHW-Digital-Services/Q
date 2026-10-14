import { mailConfig, mailRecipients, Microsoft365MailClient } from './microsoft365Mail.js';

// Send only a generic notice and link; request subjects, replies, and internal notes stay in Q.
export async function sendSupportEmail(email: string, link: string, fetcher: typeof fetch = fetch): Promise<void> {
  const config = mailConfig();
  if (!config) throw new Error('SUPPORT_MAIL_UNAVAILABLE');
  const mailbox = config.mailboxId;
  const client = new Microsoft365MailClient(config, { owner: mailbox, access: '', refresh: config.refreshToken, tokenExpires: 0, expires: Number.MAX_SAFE_INTEGER }, () => {}, fetcher);
  const accounts = await client.json('/accounts');
  const matching = (Array.isArray(accounts) ? accounts : []).filter(a => String(a.primaryEmailAddress || '').toLowerCase() === mailbox);
  if (matching.length !== 1) throw new Error('SUPPORT_MAIL_UNAVAILABLE');
  const content = `There is an update or access link for your Q support request.\n\nOpen Q to read your conversation:\n${link}\n\nKeep this link private. Email access links expire after 24 hours.\n\nQ product support is not an emergency service.`;
  await client.sendNotification(mailRecipients(email, true), content);
}

export async function sendEmailChangeConfirmations(currentEmail: string, currentLink: string, newEmail: string, newLink: string, fetcher: typeof fetch = fetch): Promise<void> {
  const config = mailConfig();
  if (!config) throw new Error('SUPPORT_MAIL_UNAVAILABLE');
  const mailbox = 'office@q-ai.online';
  const client = new Microsoft365MailClient(config, { owner: mailbox, access: '', refresh: config.refreshToken, tokenExpires: 0, expires: Number.MAX_SAFE_INTEGER }, () => {}, fetcher);
  const accounts = await client.json('/accounts');
  const matching = (Array.isArray(accounts) ? accounts : []).filter(account => String(account.primaryEmailAddress || '').toLowerCase() === mailbox);
  if (matching.length !== 1) throw new Error('SUPPORT_MAIL_UNAVAILABLE');
  const subject = 'Confirm your Q account email change';
  await client.sendNotification(mailRecipients(currentEmail, true), `An administrator requested a change to your Q sign-in email. Confirm that you approve the request using this secure link:\n\n${currentLink}\n\nThe account email changes only after confirmation from both the current and new email addresses. If you did not request this change, ignore this email and contact Q support.`, subject);
  await client.sendNotification(mailRecipients(newEmail, true), `Confirm that you can receive email at this address and approve the requested change to a Q sign-in email using this secure link:\n\n${newLink}\n\nThe account email changes only after confirmation from both the current and new email addresses. If you did not request this change, ignore this email and contact Q support.`, subject);
}
