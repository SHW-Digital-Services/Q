import { test, expect } from '@playwright/test';

test.describe('Subscription Plans', () => {
  test('displays plans', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="pricing-plan"]').first()).toBeAttached();
  });
});
