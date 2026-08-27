import { test, expect } from '@playwright/test';

test.describe('Guides', () => {
  test('displays guide cards', async ({ page }) => {
    await page.goto('/guides');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="guide-card"]').first()).toBeAttached();
  });
});
