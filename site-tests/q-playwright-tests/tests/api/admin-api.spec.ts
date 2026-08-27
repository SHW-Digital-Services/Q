import { test, expect } from '@playwright/test';

test.describe('Admin API', () => {
  test('returns the public launch setting', async ({ request }) => {
    const response = await request.get(
      '/api/v1/admin/site-settings/launch'
    );

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body).toEqual({
      enabled: expect.any(Boolean)
    });
  });

  test('rejects unauthenticated staff requests', async ({ request }) => {
    const response = await request.get(
      '/api/v1/admin/me'
    );

    expect(response.status()).toBe(401);

    const body = await response.json();

    expect(body.error).toMatch(
      /authentication required|authentication check failed/i
    );
  });

  test('rejects unauthenticated admin requests', async ({ request }) => {
    const response = await request.get(
      '/api/v1/admin/staff'
    );

    expect(response.status()).toBe(401);

    const body = await response.json();

    expect(body.error).toMatch(
      /authentication required|authentication check failed/i
    );
  });
});
