import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPad (gen 7)'] });

test.describe('Tablet', () => {
  test('renders the landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });
});
