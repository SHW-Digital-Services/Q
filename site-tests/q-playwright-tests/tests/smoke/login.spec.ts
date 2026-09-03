import { test, expect } from '@playwright/test';

test.describe('Login Smoke', () => {
  test('loads the login experience', async ({ page }) => {
    const response = await page.goto('/app', {
      waitUntil: 'domcontentloaded'
    });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^sign in$/i })
    ).toBeVisible();
  });
});
