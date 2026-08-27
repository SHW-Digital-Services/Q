import { test, expect } from '@playwright/test';

test.describe('Regression - API Contracts', () => {
  test('launch setting retains its boolean contract', async ({ request }) => {
    const response = await request.get('/api/v1/admin/site-settings/launch');
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({
      enabled: expect.any(Boolean)
    });
  });

  test('admin identity remains protected', async ({ request }) => {
    const response = await request.get('/api/v1/admin/me');
    expect(response.status()).toBe(401);
  });
});

