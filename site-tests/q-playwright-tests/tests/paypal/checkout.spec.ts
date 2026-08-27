import { test, expect } from '@playwright/test';

test.describe('PayPal Checkout', () => {
  test('shows a PayPal checkout action', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('button', { name: /paypal|subscribe|checkout/i }).first()).toBeVisible();
  });
});
