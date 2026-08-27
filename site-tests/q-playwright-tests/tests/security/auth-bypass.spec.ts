import { test, expect } from '@playwright/test';

test.describe('Authentication Bypass', () => {
  test('protects the admin identity endpoint', async ({ request }) => {
    const response = await request.get('/api/v1/admin/me');
    expect(response.status()).toBe(401);
  });
});
