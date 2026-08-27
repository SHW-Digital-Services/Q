import { test, expect } from '@playwright/test';

test.describe('Subscription Upgrade', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays upgrade action', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="upgrade-plan"]').first()).toBeAttached();
  });
});
