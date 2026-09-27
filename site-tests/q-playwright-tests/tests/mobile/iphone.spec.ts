import { test, expect, devices } from '@playwright/test';

const { defaultBrowserType: _browser, ...iphone } = devices['iPhone 15'];
test.use(iphone);

test.describe('iPhone', () => {
  test('renders the mobile landing navigation and primary content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'News & Updates' })).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });
});
