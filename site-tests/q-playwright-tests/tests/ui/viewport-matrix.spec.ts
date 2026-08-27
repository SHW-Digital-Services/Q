import { test, expect } from '@playwright/test';

const viewports = [
  ['small phone', 320, 568],
  ['iPhone SE', 375, 667],
  ['standard phone', 390, 844],
  ['large phone', 430, 932],
  ['small tablet portrait', 600, 960],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['small laptop', 1280, 720],
  ['laptop', 1366, 768],
  ['desktop', 1440, 900],
  ['large desktop', 1920, 1080],
  ['ultrawide', 2560, 1080]
] as const;

for (const [name, width, height] of viewports) {
  test(`UI renders without horizontal overflow at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(overflow).toBeFalsy();
  });
}

