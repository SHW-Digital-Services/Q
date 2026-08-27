import { test, expect } from '@playwright/test';

const supabaseUrl = process.env.SUPABASE_URL
  ?? process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  ?? process.env.VITE_SUPABASE_ANON_KEY;

test.describe('Auth API', () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    'Supabase URL and anonymous key are required'
  );

  test('rejects invalid login credentials', async ({ request }) => {
    const response = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: supabaseAnonKey!,
          Authorization: `Bearer ${supabaseAnonKey}`
        },
        data: {
          email: 'not-a-user@example.com',
          password: 'invalid-password'
        }
      }
    );

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error_code');
    expect(body).toHaveProperty('msg');
  });

  test('rejects a user request without a session token', async ({
    request
  }) => {
    const response = await request.get(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: supabaseAnonKey!
        }
      }
    );

    expect(response.status()).toBe(401);
  });

  test('validates signup request data', async ({ request }) => {
    const response = await request.post(
      `${supabaseUrl}/auth/v1/signup`,
      {
        headers: {
          apikey: supabaseAnonKey!,
          Authorization: `Bearer ${supabaseAnonKey}`
        },
        data: {
          email: 'invalid-email',
          password: 'short'
        }
      }
    );

    expect([400, 422]).toContain(response.status());

    const body = await response.json();

    expect(body.msg ?? body.message).toBeTruthy();
  });
});
