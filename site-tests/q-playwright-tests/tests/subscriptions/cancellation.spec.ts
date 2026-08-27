import { test, expect } from '@playwright/test';

test.describe('Subscription Cancellation', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays cancel action', async ({ page }) => {
    await page.goto('/subscription');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-subscription"]').first()).toBeAttached();
  });
});
