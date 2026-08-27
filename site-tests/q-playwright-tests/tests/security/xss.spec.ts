import { test, expect } from '@playwright/test';

test.describe('Cross-Site Scripting', () => {
  test('does not execute script supplied in the URL', async ({ page }) => {
    await page.goto('/?search=%3Cscript%3Ewindow.__xss=true%3C%2Fscript%3E');
    const executed = await page.evaluate(() => Boolean((window as typeof window & { __xss?: boolean }).__xss));
    expect(executed).toBeFalsy();
  });
});
