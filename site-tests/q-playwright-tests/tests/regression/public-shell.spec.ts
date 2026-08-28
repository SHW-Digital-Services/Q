import { test, expect } from '@playwright/test';

test.describe('Regression - Public Shell', () => {
  test('retains core public-page elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /Disguise Mode/i })).toBeVisible();
  });

  test('retains the protected application entry screen', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Secure Account Access')).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
