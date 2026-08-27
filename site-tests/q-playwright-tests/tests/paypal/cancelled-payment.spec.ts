import { test, expect } from '@playwright/test';

test.describe('Cancelled PayPal Payment', () => {
  test('returns the user safely from a cancelled checkout', async ({ page }) => {
    await page.goto('/pricing?paypal=cancelled');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/cancel/i).first()).toBeAttached();
  });
});
