import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('dashboard loads successfully', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard displays summary information', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('h1')).toBeVisible();
  });
});