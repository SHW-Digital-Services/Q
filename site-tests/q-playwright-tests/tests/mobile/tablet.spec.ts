import { test, expect, devices } from '@playwright/test';

const { defaultBrowserType: _browser, ...tablet } = devices['iPad (gen 7)'];
test.use(tablet);

test.describe('Tablet', () => {
  test('renders the landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });
});
