import { test, expect } from '@playwright/test';

test.describe('Memory Privacy', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays privacy controls', async ({ page }) => {
    await page.goto('/memory');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="memory-privacy"]').first()).toBeAttached();
  });
});
