import { test, expect } from '@playwright/test';

test.describe('Edit Journal Entry', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays edit action', async ({ page }) => {
    await page.goto('/journal');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="edit-journal-entry"]').first()).toBeAttached();
  });
});
