import { test, expect } from '@playwright/test';

test('keeps the app on the waitlist when launch is disabled', async ({ page }) => {
  await page.route('**/api/v1/admin/site-settings/launch', route => route.fulfill({ json: { enabled: false } }));
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In to Q App' })).toHaveCount(0);
});

test('shows sign-in when launch is enabled', async ({ page }) => {
  await page.route('**/api/v1/admin/site-settings/launch', route => route.fulfill({ json: { enabled: true } }));
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Sign In to Q App' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join the waitlist' })).toHaveCount(0);
});
