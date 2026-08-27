import { test, expect } from '@playwright/test';

test.describe('Subscription Renewal', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays renewal details', async ({ page }) => {
    await page.goto('/subscription');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="renewal-date"]').first()).toBeAttached();
  });
});
