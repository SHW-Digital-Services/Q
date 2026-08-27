import { test, expect } from '@playwright/test';

test.describe('Guide Search', () => {
  test('displays search', async ({ page }) => {
    await page.goto('/guides');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('input[type="search"]').first()).toBeAttached();
  });
});
