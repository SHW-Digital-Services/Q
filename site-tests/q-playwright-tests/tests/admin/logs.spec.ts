import { test, expect } from '@playwright/test';

test.describe('Admin Logs', () => {
  test('logs page loads', async ({ page }) => {
    await page.goto('/admin/logs');

    await expect(page.locator('body')).toBeVisible();
  });

  test('audit log table is visible', async ({ page }) => {
    await page.goto('/admin/logs');

    await expect(
      page.locator('table')
    ).toBeVisible();
  });
});