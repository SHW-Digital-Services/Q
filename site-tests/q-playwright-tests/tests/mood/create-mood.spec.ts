import { test, expect } from '@playwright/test';

test.describe('Create Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays mood choices', async ({ page }) => {
    await page.goto('/mood');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-mood]').first()).toBeAttached();
  });
});
