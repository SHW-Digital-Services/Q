import { test, expect } from '@playwright/test';

test.describe('Delete Journal Entry', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays delete action', async ({ page }) => {
    await page.goto('/journal');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="delete-journal-entry"]').first()).toBeAttached();
  });
});
