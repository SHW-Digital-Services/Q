import { test, expect } from '@playwright/test';

test.describe('UAT - Visitor Journey', () => {
  test('a visitor can understand Q and reach authentication', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toBeVisible();
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /Q Intelligence & Community/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^create account$/i })
    ).toBeVisible();
  });
});
