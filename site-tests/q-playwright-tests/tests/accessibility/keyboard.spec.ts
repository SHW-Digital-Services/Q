import { test, expect } from '@playwright/test';

test.describe('Accessibility - Keyboard', () => {
  test('authentication mode controls are keyboard operable', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    const createAccount = page.getByRole('button', {
      name: /create account/i
    });

    await createAccount.focus();
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('button', { name: /Create Confidential Account/i })
    ).toBeVisible();
  });

  test('page declares its language', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
