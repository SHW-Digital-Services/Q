import { test, expect } from '@playwright/test';

test.describe('Functional - Privacy Controls', () => {
  test('exposes the quick-exit control on public and auth screens', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Quick Exit' })).toBeVisible();

    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Quick Exit' })).toBeVisible();
  });

  test('opens disguise mode without authentication', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Disguise Mode/i }).click();

    await expect(page.getByText('QuickNotes')).toBeVisible();
    await expect(page.getByPlaceholder('Start typing your note...')).toBeVisible();
  });
});

