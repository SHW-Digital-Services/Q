import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { asyncHandler, getCanonicalAppUrl, getRequestId } from '../middleware.js';
import { allowedMailOrigin, mailConfig, mailRecipients, Microsoft365MailClient, type MailSession } from '../microsoft365Mail.js';
import { boundedString, requireExactObject } from '../security.js';

export const waitlistRouter = express.Router();

function getPublicSupabase() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function notifyWaitlistOwner(name: string, email: string, joinedAt: string) {
  const recipients = mailRecipients(process.env.WAITLIST_NOTIFICATION_TO?.trim() || '', true);
  const config = mailConfig();
  if (!config) throw new Error('Waitlist email sender is not configured.');

  const session: MailSession = {
    owner: 'waitlist-notification',
    access: '',
    refresh: config.refreshToken,
    tokenExpires: 0,
    expires: Date.now() + 60 * 60 * 1000
  };
  const mail = new Microsoft365MailClient(config, session, () => undefined);
  // Resolve the configured mailbox and obtain a short-lived Graph token using
  // the existing server-side refresh token. No mail credential reaches clients.
  const accounts = await mail.json('/accounts', { method: 'GET' });
  const matching = (Array.isArray(accounts) ? accounts : []).filter((account) =>
    String(account.primaryEmailAddress || '').toLowerCase() === config.mailboxId
  );
  if (matching.length !== 1) throw new Error('The configured notification mailbox could not be verified.');
  await mail.sendNotification(
    recipients,
    `A new person joined the Q Intelligence waitlist.\n\nName: ${name}\nEmail: ${email}\nJoined: ${joinedAt}\n\nThis message contains waitlist contact details. Handle it as confidential personal information.`,
    'New Q Intelligence waitlist signup'
  );
}

waitlistRouter.post('/', asyncHandler(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');

  const origin = request.header('origin');
  if (!origin || !allowedMailOrigin(origin, getCanonicalAppUrl())) {
    return response.status(403).json({ error: 'This request origin is not allowed.' });
  }

  if (!requireExactObject(request.body, ['name', 'email', 'adultConfirmed'])) {
    return response.status(400).json({ error: 'Enter your name, email address, and confirm that you are 18 or older.' });
  }
  const name = boundedString(request.body.name, 120, true);
  const emailValue = boundedString(request.body.email, 320, true);
  if (!name || /[\u0000-\u001f\u007f]/.test(name) || !emailValue || request.body.adultConfirmed !== true) {
    return response.status(400).json({ error: 'Enter a valid name and email address, and confirm that you are 18 or older.' });
  }
  const email = emailValue.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Enter a valid email address.' });
  }

  const supabase = getPublicSupabase();
  if (!supabase) return response.status(503).json({ error: 'The waitlist is temporarily unavailable.' });

  const { error } = await supabase.from('waitlist').insert({ name, email });
  if (error?.code === '23505') return response.json({ status: 'already_joined' });
  if (error) {
    console.error(`[Waitlist] insert failed requestId=${getRequestId(request)} code=${error.code || 'unknown'}`);
    return response.status(503).json({ error: 'The waitlist is temporarily unavailable.' });
  }

  const joinedAt = new Date().toISOString();
  try {
    await notifyWaitlistOwner(name, email, joinedAt);
  } catch (notificationError) {
    // The signup is already committed. Do not tell the visitor it failed or
    // invite a duplicate retry; leave an operational log without PII.
    console.error(`[Waitlist Notification] failed requestId=${getRequestId(request)}`, notificationError instanceof Error ? notificationError.message : 'unknown error');
  }

  return response.status(201).json({ status: 'joined' });
}));
