import { test, expect } from '@playwright/test';

test.describe('PayPal Annual Plan', () => {
  test('offers annual billing', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/annual|yearly/i).first()).toBeVisible();
  });
});
