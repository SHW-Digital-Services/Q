import { test, expect } from '@playwright/test';

test.describe('Performance - Page Load', () => {
  test('loads the local landing page within the regression budget', async ({ page }) => {
    const startedAt = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(15_000);
  });

  test('keeps DOM size within the local regression budget', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elementCount = await page.locator('*').count();

    expect(elementCount).toBeLessThan(2_000);
  });
});

