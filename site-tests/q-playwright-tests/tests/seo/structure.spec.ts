import { test, expect } from '@playwright/test';

test.describe('SEO - Document Structure', () => {
  test('uses one visible H1 and a meaningful language', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).not.toHaveText('');
  });

  test('does not expose broken same-origin links', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const links = await page.locator('a[href^="/"]').evaluateAll(
      anchors => [...new Set(anchors.map(anchor => (anchor as HTMLAnchorElement).href))]
    );

    for (const link of links) {
      const response = await request.get(link);
      expect(response.status(), link).toBeLessThan(400);
    }
  });
});

