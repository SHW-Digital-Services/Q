import express from 'express';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '../middleware';
import { buildAnalyticsExport } from '../analyticsEngine';

export const adminRouter = express.Router();
const serviceSupabase = process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

interface PasswordResetRequest {
  id: string;
  email: string;
  message: string;
  createdAt: string;
  status: 'pending' | 'reset' | 'failed';
  tempPassword?: string;
}

const passwordResetRequests: PasswordResetRequest[] = [];

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(16);
  let password = '';
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }
  return password;
}

async function requireAdmin(req: express.Request, res: express.Response) {
  const identity = await getAuthenticatedUser(req);
  if (!identity || !serviceSupabase) {
    res.status(403).json({ error: 'Access denied: Admin authorization required.' });
    return null;
  }
  return identity;
}

adminRouter.post('/password-reset-requests', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!email) {
    return res.status(400).json({ error: 'An email address is required.' });
  }

  const request: PasswordResetRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    message,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  passwordResetRequests.unshift(request);
  return res.json({ success: true, request });
});

adminRouter.get('/password-reset-requests', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  return res.json(passwordResetRequests);
});

adminRouter.post('/password-reset-requests/:id/reset', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Supabase admin access is not configured. Please set SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const request = passwordResetRequests.find((entry) => entry.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Password reset request not found.' });
  }

  try {
    const tempPassword = generateTemporaryPassword();
    const { data: usersData, error: lookupError } = await serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const targetUser = usersData?.users?.find((u: any) => u.email?.toLowerCase() === request.email.toLowerCase());

    if (lookupError) {
      console.error('[Admin] listUsers error:', lookupError);
    }

    if (!targetUser?.id) {
      request.status = 'failed';
      return res.status(404).json({ error: `No registered user found for email: ${request.email}` });
    }

    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(targetUser.id, {
      password: tempPassword,
      email_confirm: true
    });

    if (updateError) throw updateError;

    let recoveryLink: string | undefined;
    try {
      const { data: linkData } = await serviceSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: request.email
      });
      if (linkData?.properties?.action_link) {
        recoveryLink = linkData.properties.action_link;
      }
    } catch (linkErr) {
      console.warn('[Admin] Recovery link generation error:', linkErr);
    }

    request.status = 'reset';
    request.tempPassword = tempPassword;
    return res.json({ success: true, tempPassword, recoveryLink, request });
  } catch (error: any) {
    console.error('[Admin] Password reset failed:', error);
    request.status = 'failed';
    return res.status(500).json({ error: error.message || 'Unable to reset the password.' });
  }
});

adminRouter.post('/direct-password-reset', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Supabase admin access is not configured. Please set SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  try {
    const tempPassword = generateTemporaryPassword();
    const { data: usersData, error: lookupError } = await serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const targetUser = usersData?.users?.find((u: any) => u.email?.toLowerCase() === email);

    if (lookupError) {
      console.error('[Admin] listUsers error:', lookupError);
    }

    if (!targetUser?.id) {
      return res.status(404).json({ error: `No registered user found with email: ${email}` });
    }

    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(targetUser.id, {
      password: tempPassword,
      email_confirm: true
    });

    if (updateError) throw updateError;

    let recoveryLink: string | undefined;
    try {
      const { data: linkData } = await serviceSupabase.auth.admin.generateLink({
        type: 'recovery',
        email
      });
      if (linkData?.properties?.action_link) {
        recoveryLink = linkData.properties.action_link;
      }
    } catch (linkErr) {
      console.warn('[Admin] Recovery link generation error:', linkErr);
    }

    return res.json({ success: true, email, tempPassword, recoveryLink });
  } catch (error: any) {
    console.error('[Admin] Direct password reset failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to reset password.' });
  }
});

adminRouter.get('/provider-insights', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { data, error } = await serviceSupabase!.from('providers').select('id, org_type, verification_status');
    if (error) throw error;
    return res.json({
      generatedAt: new Date().toISOString(),
      totalProviders: data?.length ?? 0,
      verifiedCount: data?.filter((provider) => provider.verification_status === 'verified').length ?? 0,
      reportType: 'partner_value_preview'
    });
  } catch (error) {
    console.error('[Admin] Provider insights error:', error);
    return res.status(500).json({ error: 'Could not fetch provider metrics.' });
  }
});

adminRouter.get('/data-moat-export', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const [{ data: messages, error: messagesError }, { data: feedback, error: feedbackError }] = await Promise.all([
      serviceSupabase!.from('chat_messages').select('user_id, content, created_at').order('created_at'),
      serviceSupabase!.from('sentiment_feedback').select('flagged_unsafe, score')
    ]);
    if (messagesError || feedbackError) throw messagesError ?? feedbackError;
    return res.json(buildAnalyticsExport(messages ?? [], feedback ?? []));
  } catch (error) {
    console.error('[Admin] Data export error:', error);
    return res.status(500).json({ error: 'Aggregate export failed privacy validation.' });
  }
});
