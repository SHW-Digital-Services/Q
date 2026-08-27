import { test, expect } from '@playwright/test';

test.describe('Session Timeout', () => {
  test('does not treat an expired token as authenticated', async ({ request }) => {
    const response = await request.get('/api/v1/admin/me', {
      headers: { Authorization: 'Bearer expired.token.placeholder' }
    });
    expect(response.status()).toBe(401);
  });
});
