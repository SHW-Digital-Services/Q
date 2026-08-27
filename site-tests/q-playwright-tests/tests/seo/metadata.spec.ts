import { test, expect } from '@playwright/test';

test.describe('SEO - Metadata', () => {
  test('has a descriptive title and viewport', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/Q.+LGBTQ.+Wellbeing.+Support/i);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /width=device-width/
    );
  });

  test('has a useful meta description', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const description = page.locator('meta[name="description"]');

    await expect(description).toHaveAttribute('content', /.{50,160}/);
  });
});

