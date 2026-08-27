import { test, expect } from '@playwright/test';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

const tables = [
  'memory_entries',
  'journal_entries',
  'daily_mood_logs',
  'chat_messages',
  'vetted_knowledge_chunks',
  'profiles',
  'audit_logs',
  'providers',
  'sentiment_feedback',
  'subscriptions',
  'waitlist',
  'password_reset_requests',
  'crm_products',
  'crm_notes',
  'crm_tasks',
  'crm_payments',
  'crm_entitlements',
  'crm_activities',
  'site_settings',
  'paypal_webhook_events',
  'referral_codes',
  'referrals',
  'referral_credits',
  'founder_subscriber_slots'
];

test.describe('Database - Schema Availability', () => {
  test.skip(!supabaseUrl || !anonKey, 'Supabase test-project values are required');

  for (const table of tables) {
    test(`${table} exists in the API schema`, async ({ request }) => {
      const response = await request.get(
        `${supabaseUrl}/rest/v1/${table}?select=*&limit=0`,
        { headers: { apikey: anonKey! } }
      );

      expect(response.status(), await response.text()).not.toBe(404);
    });
  }
});

