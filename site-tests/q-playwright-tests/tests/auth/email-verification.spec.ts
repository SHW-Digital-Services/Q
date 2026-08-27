import { test, expect } from '@playwright/test';

test.describe('Email Verification', () => {
  test('collects an email address for account creation', async ({ page }) => {
    await page.goto('/app');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create confidential account/i })).toBeVisible();
  });
});
