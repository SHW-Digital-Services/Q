import { test, expect, devices } from '@playwright/test';

const pixel7 = devices['Pixel 7'];

// Preserve the browser selected by the Playwright project while applying the
// Pixel viewport and input characteristics. The device preset otherwise forces
// Chromium, which is not installed in the isolated Firefox and WebKit jobs.
test.use({
  viewport: pixel7.viewport,
  userAgent: pixel7.userAgent,
  deviceScaleFactor: pixel7.deviceScaleFactor,
  isMobile: pixel7.isMobile,
  hasTouch: pixel7.hasTouch
});

test.describe('Android', () => {
  test('renders the landing page without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBeFalsy();
  });
});
