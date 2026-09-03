import { test, expect } from '@playwright/test';

test.describe('Functional - Authentication Navigation', () => {
  test('opens the Q authentication screen directly', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /Q Intelligence & Community/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^sign in$/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^create account$/i })
    ).toBeVisible();
  });

  test('switches between sign-in and account creation', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', {
      name: /^create account$/i
    }).click();

    await expect(
      page.getByPlaceholder('e.g. Alex Rivera')
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: /Create Confidential Account/i
      })
    ).toBeVisible();

    await page.getByRole('button', {
      name: /^sign in$/i
    }).click();

    await expect(
      page.getByRole('button', { name: /Sign In to Q App/i })
    ).toBeVisible();
  });
});
