import { test, expect } from '@playwright/test';

test.describe('Admin Subscriptions', () => {
  test('subscription page loads', async ({ page }) => {
    await page.goto(
      '/admin/subscriptions'
    );

    await expect(
      page.locator('body')
    ).toBeVisible();
  });

  test('subscription list is displayed', async ({ page }) => {
    await page.goto(
      '/admin/subscriptions'
    );

    await expect(
      page.locator('table')
    ).toBeVisible();
  });
});