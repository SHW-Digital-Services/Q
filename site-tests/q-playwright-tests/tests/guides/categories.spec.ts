import { test, expect } from '@playwright/test';

test.describe('Guide Categories', () => {
  test('displays category filters', async ({ page }) => {
    await page.goto('/guides');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="guide-category"]').first()).toBeAttached();
  });
});
