import { test, expect } from '@playwright/test';

test.describe('AI Chat', () => {
  test('the app login screen loads before chat', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /Q Intelligence/i })).toBeVisible();
  });
});

