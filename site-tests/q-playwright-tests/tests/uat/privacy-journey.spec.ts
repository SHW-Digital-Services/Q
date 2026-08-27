import { test, expect } from '@playwright/test';

test.describe('UAT - Privacy Journey', () => {
  test('a visitor can see privacy reassurance and emergency exit', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('100% Private')).toBeVisible();
    await expect(page.getByText('PIN Lock Protection')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Exit' })).toBeVisible();
  });
});

