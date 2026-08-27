import { test, expect } from '@playwright/test';

test.describe('Mood Analytics', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays analytics', async ({ page }) => {
    await page.goto('/mood');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="mood-analytics"]').first()).toBeAttached();
  });
});
