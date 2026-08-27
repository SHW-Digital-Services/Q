import { test, expect } from '@playwright/test';

test.describe('Export Journal', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays export action', async ({ page }) => {
    await page.goto('/journal');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="export-journal"]').first()).toBeAttached();
  });
});
