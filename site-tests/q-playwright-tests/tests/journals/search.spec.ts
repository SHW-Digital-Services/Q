import { test, expect } from '@playwright/test';

test.describe('Journal Search', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays search', async ({ page }) => {
    await page.goto('/journal');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('input[type="search"]').first()).toBeAttached();
  });
});
