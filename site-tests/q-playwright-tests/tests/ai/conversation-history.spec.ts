import { test, expect } from '@playwright/test';

test.describe('Conversation History', () => {
  test('messages appear in history', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('textarea', 'History test');
    await page.keyboard.press('Enter');

    await expect(
      page.locator('text=History test')
    ).toBeVisible();
  });

  test('history persists after reload', async ({ page }) => {
    await page.goto('/chat');

    await page.fill(
      'textarea',
      'Persistent message'
    );

    await page.keyboard.press('Enter');

    await page.reload();

    await expect(
      page.locator('body')
    ).toContainText('Persistent message');
  });
});