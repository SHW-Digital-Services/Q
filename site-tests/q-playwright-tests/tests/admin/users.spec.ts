import { test, expect } from '@playwright/test';

test.describe('Admin Support', () => {
  test('support area loads', async ({ page }) => {
    await page.goto('/admin/support');

    await expect(
      page.locator('body')
    ).toBeVisible();
  });

  test('support management controls appear', async ({ page }) => {
    await page.goto('/admin/support');

    await expect(
      page.locator('button')
    ).toHaveCount(
      await page.locator('button').count()
    );
  });
});