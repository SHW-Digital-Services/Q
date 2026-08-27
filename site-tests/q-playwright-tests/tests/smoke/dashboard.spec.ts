import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke', () => {
  test('protects or renders the dashboard route', async ({ page }) => {
    const response = await page.goto('/app', {
      waitUntil: 'domcontentloaded'
    });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
});
