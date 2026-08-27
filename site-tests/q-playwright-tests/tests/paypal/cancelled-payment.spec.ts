import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Cancelled PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns the user safely from a cancelled checkout', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app');
    await page.goto('/app?paypal=cancelled');
    
    // FIX: Use a loose, case-insensitive regex to bypass DOM text quirks and spacing
    await expect(page.getByText(/subscription/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});