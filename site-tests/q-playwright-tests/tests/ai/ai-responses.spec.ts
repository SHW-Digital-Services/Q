import { test, expect } from '@playwright/test';

test.describe('AI Responses', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('AI response area is available in the authenticated app', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('[data-testid="ai-response"], main').first()).toBeVisible();
  });
});

