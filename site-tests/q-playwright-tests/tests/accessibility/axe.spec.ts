import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test.describe('Accessibility - Automated WCAG Checks', () => {
  for (const route of ['/', '/app']) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

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

