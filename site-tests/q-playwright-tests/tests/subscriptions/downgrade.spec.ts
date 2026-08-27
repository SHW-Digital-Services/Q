import { test, expect } from '@playwright/test';

test.describe('Subscription Downgrade', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays downgrade action', async ({ page }) => {
    await page.goto('/subscription');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="downgrade-plan"]').first()).toBeAttached();
  });
});
