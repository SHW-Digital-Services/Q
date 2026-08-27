import { test, expect } from '@playwright/test';

test.describe('Home Smoke', () => {
  test('loads the home page', async ({ page }) => {
    const response = await page.goto('/', {
      waitUntil: 'domcontentloaded'
    });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });
});
