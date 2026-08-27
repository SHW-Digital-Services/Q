import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Failed PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns failed checkout attempts to a safe subscription screen', async ({ page, loginAsUser }) => {
    await loginAsUser();
    
    // Wait for the login redirect to finish before navigating away
    await page.waitForURL('**/app');
    
    await page.goto('/app?paypal=failed');
    
    await expect(page.getByRole('heading', { name: /subscription/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});