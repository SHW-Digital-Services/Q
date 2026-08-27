import { test, expect } from '@playwright/test';

test.describe('Role Escalation', () => {
  test('rejects role changes without partner admin authentication', async ({ request }) => {
    const response = await request.patch('/api/v1/admin/users/placeholder-user/role', {
      data: { role: 'partner_admin' }
    });
    expect(response.status()).toBe(401);
  });
});
