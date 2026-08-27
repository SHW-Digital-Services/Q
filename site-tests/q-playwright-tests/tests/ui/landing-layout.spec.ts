import { test, expect } from '@playwright/test';

test.describe('UI - Landing Layout', () => {
  test('renders one primary heading and visible content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toBeVisible();
  });

  test('does not overflow horizontally at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(hasOverflow).toBeFalsy();
  });
});

