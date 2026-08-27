import { test, expect } from '@playwright/test';

test.describe('Long Conversations', () => {
  test('handles multiple consecutive messages', async ({ page }) => {
    await page.goto('/chat');

    for (let i = 1; i <= 10; i++) {
      await page.fill(
        'textarea',
        `Message ${i}`
      );

      await page.keyboard.press('Enter');
    }

    await expect(
      page.locator('text=Message 10')
    ).toBeVisible();
  });

  test('conversation remains responsive', async ({ page }) => {
    await page.goto('/chat');

    for (let i = 1; i <= 20; i++) {
      await page.fill(
        'textarea',
        `Test ${i}`
      );

      await page.keyboard.press('Enter');
    }

    await expect(
      page.locator('textarea')
    ).toBeEnabled();
  });
});