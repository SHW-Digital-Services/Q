import { test, expect } from '@playwright/test';

test.describe('Failed PayPal Payment', () => {
  test('renders failed-payment feedback', async ({ page }) => {
    await page.goto('/pricing?paypal=failed');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/failed|problem|try again/i).first()).toBeAttached();
  });
});
