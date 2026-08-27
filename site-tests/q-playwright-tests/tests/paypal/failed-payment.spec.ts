import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Failed PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns failed checkout attempts to a safe subscription screen', async ({ page, loginAsUser }) => {
    await loginAsUser();
    
    // FIX: Wait for the dashboard to render to ensure auth session is saved before navigating
    await expect(page.getByText(/Private Journal/i).first()).toBeVisible();
    
    await page.goto('/app?paypal=failed');
    
    await expect(page.getByText('Subscription', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});