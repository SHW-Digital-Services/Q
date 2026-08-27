import { test, expect } from '@playwright/test';

test.describe('Registration', () => {
  test('shows registration controls', async ({ page }) => {
    await page.goto('/app');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create confidential account/i })).toBeVisible();
  });
});
