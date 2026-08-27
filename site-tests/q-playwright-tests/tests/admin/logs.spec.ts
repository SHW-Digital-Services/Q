import { test, expect } from '@playwright/test';

test.describe('Admin Logs', () => {
  test('logs page loads', async ({ page }) => {
    await page.goto('/admin/logs');

    await expect(page.locator('body')).toBeVisible();
  });

  test('audit data is protected from anonymous access', async ({ request }) => {
    const response = await request.get('/api/v1/admin/crm/users');
    expect([401, 403]).toContain(response.status());
  });
});
