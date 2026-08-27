import { test, expect } from '@playwright/test';

test.describe('Session', () => {
  test('requires authentication at the protected app entry', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('button', { name: /sign in to q app/i })).toBeVisible();
    await expect(page.getByText(/create an account or log in/i)).toBeVisible();
  });
});
