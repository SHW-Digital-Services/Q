import { test, expect } from '@playwright/test';

test.describe('PayPal Monthly Plan', () => {
  test('offers monthly billing', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/monthly|month/i).first()).toBeVisible();
  });
});
