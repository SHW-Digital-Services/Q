import { test, expect } from '@playwright/test';

test.describe('Memory Persistence', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays saved memories', async ({ page }) => {
    await page.goto('/memory');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="memory-item"]').first()).toBeAttached();
  });
});
