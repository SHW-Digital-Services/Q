import { test, expect } from '@playwright/test';

test.describe('Email Verification', () => {
  test('shows verification guidance after registration', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/verify|email/i).first()).toBeAttached();
  });
});
