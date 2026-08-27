import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Android', () => {
  test('renders the landing page without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBeFalsy();
  });
});
