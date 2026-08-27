import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('validates the reset email', async ({ page }) => {
    await page.goto('/app');
    await page.getByText(/forgot|reset password/i).click();
    
    // Scope the search ONLY to the active dialog/modal
    const resetModal = page.getByRole('dialog');
    const resetEmailInput = resetModal.getByLabel(/email/i);
    
    await resetEmailInput.fill('invalid-email');
    await resetModal.getByRole('button', { name: /send request/i }).click();
    
    expect(await resetEmailInput.evaluate(input => (input as HTMLInputElement).validity.valid)).toBeFalsy();
  });
});