import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/app',
  '/?view=app',
  '/?open=q',
  '/app/',
  '/legal/privacy',
  '/legal/terms',
  '/legal/security',
  '/legal/cookies',
  '/legal/community-guidelines'
];

for (const route of routes) {
  test(`Regression route ${route} does not return a server error`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
}

