import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 15'] });

test.describe('iPhone', () => {
  test('renders the mobile navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu"], button[aria-label*="menu" i]').first()).toBeAttached();
  });
});
