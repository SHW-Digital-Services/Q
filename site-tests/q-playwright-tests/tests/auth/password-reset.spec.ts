import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('validates the reset email', async ({ page }) => {
    await page.goto('/app');
    
    // Open the password reset modal
    await page.getByText(/forgot|reset password/i).click();
    
    // Target the specific reset email input to avoid strict mode violations 
    // with the underlying login form's email field
    const resetEmailInput = page.locator('#reset-email');
    await resetEmailInput.fill('invalid-email');
    
    // Attempt to submit
    await page.getByRole('button', { name: /send request/i }).click();
    
    // Validate that the browser's native HTML5 email validation caught the invalid format
    expect(await resetEmailInput.evaluate(input => (input as HTMLInputElement).validity.valid)).toBeFalsy();
  });
});