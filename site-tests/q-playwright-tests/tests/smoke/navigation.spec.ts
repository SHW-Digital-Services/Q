import { test, expect } from '@playwright/test';

test.describe('Navigation Smoke', () => {
  test('provides accessible navigation', async ({ page }) => {
    await page.goto('/', {
      waitUntil: 'domcontentloaded'
    });
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
  });
});
