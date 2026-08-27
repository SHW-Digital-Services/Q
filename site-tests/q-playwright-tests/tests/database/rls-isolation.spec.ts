import { test, expect, APIRequestContext } from '@playwright/test';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const firstEmail = process.env.FREE_USER_EMAIL;
const firstPassword = process.env.FREE_USER_PASSWORD;
const secondEmail = process.env.SUBSCRIBER_EMAIL;
const secondPassword = process.env.SUBSCRIBER_PASSWORD;

async function login(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const response = await request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: anonKey! },
      data: { email, password }
    }
  );
  const body = await response.json();

  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body.user?.id).toBeTruthy();

  return {
    token: body.access_token as string,
    userId: body.user.id as string
  };
}

test.describe('Database - RLS Isolation', () => {
  test.skip(
    !supabaseUrl || !anonKey || !firstEmail || !firstPassword ||
      !secondEmail || !secondPassword,
    'Two configured Supabase test users are required'
  );

  test('one user cannot read another user memory', async ({ request }) => {
    const firstUser = await login(request, firstEmail!, firstPassword!);
    const secondUser = await login(request, secondEmail!, secondPassword!);
    const marker = `playwright-rls-${Date.now()}`;
    const headers = {
      apikey: anonKey!,
      Authorization: `Bearer ${firstUser.token}`,
      Prefer: 'return=representation'
    };

    const created = await request.post(
      `${supabaseUrl}/rest/v1/memory_entries`,
      {
        headers,
        data: {
          user_id: firstUser.userId,
          kind: 'test',
          content: marker
        }
      }
    );
    expect(created.ok(), await created.text()).toBeTruthy();
    const [row] = await created.json();

    try {
      const otherUserRead = await request.get(
        `${supabaseUrl}/rest/v1/memory_entries?id=eq.${row.id}&select=id`,
        {
          headers: {
            apikey: anonKey!,
            Authorization: `Bearer ${secondUser.token}`
          }
        }
      );

      expect(otherUserRead.ok(), await otherUserRead.text()).toBeTruthy();
      expect(await otherUserRead.json()).toEqual([]);
    } finally {
      await request.delete(
        `${supabaseUrl}/rest/v1/memory_entries?id=eq.${row.id}`,
        { headers }
      );
    }
  });
});
