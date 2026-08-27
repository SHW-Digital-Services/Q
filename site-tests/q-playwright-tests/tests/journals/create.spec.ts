import { test, expect } from '@playwright/test';

test.describe('Create Journal Entry', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays entry editor', async ({ page }) => {
    await page.goto('/journal');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('textarea').first()).toBeAttached();
  });
});
