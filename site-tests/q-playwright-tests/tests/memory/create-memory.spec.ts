import { test, expect } from '@playwright/test';

test.describe('Create Memory', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays memory editor', async ({ page }) => {
    await page.goto('/memory');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('textarea').first()).toBeAttached();
  });
});
