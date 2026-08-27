import { test, expect } from '@playwright/test';

test.describe('CSRF Protection', () => {
  test('does not allow an unauthenticated settings mutation', async ({ request }) => {
    const response = await request.patch('/api/v1/admin/site-settings/launch', {
      headers: { Origin: 'https://attacker.invalid' },
      data: { enabled: true }
    });
    expect([401, 403]).toContain(response.status());
  });
});
