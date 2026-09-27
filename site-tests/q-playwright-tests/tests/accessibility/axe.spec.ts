import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test.describe('Accessibility - Automated WCAG Checks', () => {
  for (const route of ['/', '/app']) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      // Full accessibility scans can exceed the interaction-test timeout in Firefox.
      test.setTimeout(60_000);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      if (route === '/app') {
        await expect(page.getByRole('heading', { name: 'Q Intelligence & Community' })).toBeVisible();
      } else {
        await expect(page.locator('h1')).toBeVisible();
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        violation => ['serious', 'critical'].includes(violation.impact ?? '')
      );

      expect(blocking).toEqual([]);
    });
  }
});
