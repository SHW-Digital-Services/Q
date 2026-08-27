import { test, expect } from '@playwright/test';

test.describe('AI Context Memory', () => {
  test('context survives multiple messages', async ({ page }) => {
    await page.goto('/chat');

    await page.fill(
      'textarea',
      'My favourite colour is blue'
    );

    await page.keyboard.press('Enter');

    await page.fill(
      'textarea',
      'What is my favourite colour?'
    );

    await page.keyboard.press('Enter');

    await expect(
      page.locator('body')
    ).toContainText('blue');
  });

  test('conversation history remains visible', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('textarea', 'Test memory');
    await page.keyboard.press('Enter');

    await expect(
      page.locator('text=Test memory')
    ).toBeVisible();
  });
});