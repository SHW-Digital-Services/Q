import { test, expect } from '@playwright/test';

test.describe('SQL Injection', () => {
  test('does not bypass authorization with an injected identifier', async ({ request }) => {
    const payload = encodeURIComponent("' OR 1=1 --");
    const response = await request.get(`/api/v1/admin/crm/users/${payload}`);
    expect(response.status()).toBe(401);
  });
});
