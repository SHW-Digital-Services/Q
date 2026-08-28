import { test, expect } from '@playwright/test';

test.describe('Functional - Privacy Controls', () => {
  test('exposes one disguise control on public and auth screens', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Disguise Mode/i })).toHaveCount(1);

    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Disguise Mode/i })).toHaveCount(1);
  });

  test('opens disguise mode without authentication', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Disguise Mode/i }).click();

    await expect(page.getByText('QuickNotes')).toBeVisible();
    await expect(page.getByPlaceholder('Start typing your note...')).toBeVisible();
    await page.getByRole('button', { name: 'Return to previous app' }).click();
    await expect(page.getByRole('button', { name: /Disguise Mode/i })).toBeVisible();
  });
});
