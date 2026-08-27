import { test, expect } from '@playwright/test';

const supabaseUrl = process.env.SUPABASE_URL
  ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY
  ?? process.env.VITE_SUPABASE_ANON_KEY;

test.describe('Mood API', () => {
  test.skip(!supabaseUrl || !anonKey, 'Supabase test-project values are required');

  test('does not expose mood rows without authentication', async ({ request }) => {
    const response = await request.get(
      `${supabaseUrl}/rest/v1/daily_mood_logs?select=id&limit=1`,
      { headers: { apikey: anonKey! } }
    );

    expect([200, 401, 403]).toContain(response.status());

    if (response.ok()) {
      expect(await response.json()).toEqual([]);
    }
  });

  test('returns a JSON response from the Supabase REST API', async ({ request }) => {
    const response = await request.get(
      `${supabaseUrl}/rest/v1/daily_mood_logs?select=id&limit=1`,
      { headers: { apikey: anonKey! } }
    );
    const contentType = response.headers()['content-type'] ?? '';

    expect(contentType).toContain('application/json');
  });
});

