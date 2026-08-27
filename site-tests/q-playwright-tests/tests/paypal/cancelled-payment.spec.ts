import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Cancelled PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns the user safely from a cancelled checkout', async ({ page, loginAsUser }) => {
    await loginAsUser();
    
    // FIX: Wait for the dashboard to render to ensure auth session is saved before navigating
    await expect(page.getByText(/Private Journal/i).first()).toBeVisible();
    
    await page.goto('/app?paypal=cancelled');
    
    await expect(page.getByText('Subscription', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});