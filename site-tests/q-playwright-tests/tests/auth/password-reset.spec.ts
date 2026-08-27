import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('validates the reset email', async ({ page }) => {
    await page.goto('/app');
    await page.getByText(/forgot|reset password/i).click();
    
    // Bypass role issues and grab the second email input on the page (the modal overlay)
    const resetEmailInput = page.locator('input[type="email"]').nth(1);
    
    await resetEmailInput.fill('invalid-email');
    await page.getByRole('button', { name: /send request/i }).click();
    
    expect(await resetEmailInput.evaluate(input => (input as HTMLInputElement).validity.valid)).toBeFalsy();
  });
});