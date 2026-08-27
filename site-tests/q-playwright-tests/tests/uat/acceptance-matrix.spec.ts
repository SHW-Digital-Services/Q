import { test, expect } from '@playwright/test';

const acceptanceCopy = [
  ['brand heading', /Q Intelligence & Community/i],
  ['authentication engine', /Supabase Auth Engine/i],
  ['privacy reassurance', /100% Private/i],
  ['PIN protection', /PIN Lock Protection/i],
  ['sign-in mode', /^Sign In$/i],
  ['account creation mode', /^Create Account$/i],
  ['forgot-password route', /Forgot password/i]
] as const;

for (const [journey, text] of acceptanceCopy) {
  test(`UAT presents ${journey}`, async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(text).first()).toBeVisible();
  });
}

test('UAT presents email field', async ({ page }) => {
  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('name@example.com').first()).toBeVisible();
});
