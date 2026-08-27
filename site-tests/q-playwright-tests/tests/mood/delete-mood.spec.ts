import { test, expect } from '@playwright/test';

test.describe('Delete Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays delete action', async ({ page }) => {
    await page.goto('/mood');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="delete-mood"]').first()).toBeAttached();
  });
});
