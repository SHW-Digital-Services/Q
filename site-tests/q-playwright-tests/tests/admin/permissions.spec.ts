import { test, expect } from '@playwright/test';

test.describe('Admin Permissions', () => {
  test('unauthenticated API users are blocked', async ({ request }) => {
    const response = await request.get('/api/v1/admin/me');
    expect(response.status()).toBe(401);
  });

  test('admin role changes require authentication', async ({ request }) => {
    const response = await request.patch('/api/v1/admin/users/placeholder/role', {
      data: { role: 'partner_admin' }
    });
    expect(response.status()).toBe(401);
  });
});

