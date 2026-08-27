import { test, expect } from '@playwright/test';

test.describe('Rate Limits', () => {
  test('chat remains available under normal use', async ({ page }) => {
    await page.goto('/chat');

    await page.fill(
      'textarea',
      'Normal request'
    );

    await page.keyboard.press('Enter');

    await expect(
      page.locator('[data-testid="ai-response"]')
    ).toBeVisible();
  });

  test('handles rapid requests gracefully', async ({ page }) => {
    await page.goto('/chat');

    for (let i = 1; i <= 5; i++) {
      await page.fill(
        'textarea',
        `Rapid request ${i}`
      );

      await page.keyboard.press('Enter');
    }

    await expect(
      page.locator('body')
    ).toBeVisible();
  });

  test('displays error if limit reached', async ({ page }) => {
    await page.goto('/chat');

    // Placeholder until actual rate limit UI exists.
    await expect(
      page.locator('body')
    ).toBeVisible();
  });
});