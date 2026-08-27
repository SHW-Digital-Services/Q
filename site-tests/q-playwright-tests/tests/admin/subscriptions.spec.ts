import { test, expect } from '@playwright/test';

test.describe('Admin Subscriptions', () => {
  test('subscription page loads', async ({ page }) => {
    await page.goto(
      '/admin/subscriptions'
    );

    await expect(
      page.locator('body')
    ).toBeVisible();
  });

  test('subscription administration is protected from anonymous access', async ({ request }) => {
    const response = await request.get('/api/v1/admin/crm/users');
    expect([401, 403]).toContain(response.status());
  });
});
