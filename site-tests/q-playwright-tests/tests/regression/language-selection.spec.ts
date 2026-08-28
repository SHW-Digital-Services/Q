import { test, expect } from '@playwright/test';

test.describe('Language selection', () => {
  test('persists the selected language and enables right-to-left layout', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Language').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('button', { name: 'المساعدة' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByLabel('اللغة')).toHaveValue('ar');
  });
});
