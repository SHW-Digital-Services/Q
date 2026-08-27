import { test, expect } from '@playwright/test';

test.describe('Session', () => {
  test('redirects an unauthenticated user from a protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|signin|auth/);
  });
});
