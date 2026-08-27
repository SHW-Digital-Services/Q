import { test, expect } from '@playwright/test';

test.describe('Guide Bookmarks', () => {
  test('displays bookmark', async ({ page }) => {
    await page.goto('/guides');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="bookmark-button"]').first()).toBeAttached();
  });
});
