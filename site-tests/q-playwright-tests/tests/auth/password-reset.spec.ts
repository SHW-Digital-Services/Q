import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('validates the reset email', async ({ page }) => {
    await page.goto('/app');
    await page.getByText(/forgot|reset password/i).click();
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByRole('button', { name: /send request/i }).click();
    const email = page.getByLabel('Email address').last();
    expect(await email.evaluate(input => (input as HTMLInputElement).validity.valid)).toBeFalsy();
  });
});
