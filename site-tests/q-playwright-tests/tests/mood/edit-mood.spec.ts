import { test, expect } from '@playwright/test';

test.describe('Edit Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays edit action', async ({ page }) => {
    await page.goto('/mood');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="edit-mood"]').first()).toBeAttached();
  });
});
