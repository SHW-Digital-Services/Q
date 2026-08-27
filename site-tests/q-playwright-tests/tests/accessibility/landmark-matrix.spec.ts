import { test, expect } from '@playwright/test';

const checks = [
  ['public main landmark', '/', 'main'],
  ['public heading', '/', 'h1'],
  ['public quick exit name', '/', 'button[aria-label="Quick Exit"]'],
  ['auth main content', '/app', 'form'],
  ['auth email input', '/app', 'input[type="email"]'],
  ['auth password input', '/app', 'input[type="password"]'],
  ['auth sign-in action', '/app', 'button[type="submit"]'],
  ['document language', '/', 'html[lang="en"]']
] as const;

for (const [name, route, selector] of checks) {
  test(`Accessibility exposes ${name}`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selector).first()).toBeVisible();
  });
}

