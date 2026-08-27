import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('validates the reset email', async ({ page }) => {
    await page.goto('/login');
    await page.getByText(/forgot|reset password/i).click();
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByRole('button', { name: /send|reset/i }).click();
    await expect(page.getByText(/valid email|invalid/i).first()).toBeVisible();
  });
});
