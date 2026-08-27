import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Failed PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns failed checkout attempts to a safe subscription screen', async ({ page, loginAsUser }) => {
    await loginAsUser();
    
    // FIX: Explicitly wait for the login screen to disappear so we know auth is complete
    // This prevents the page.goto() from cancelling the Supabase login request
    await expect(page.getByRole('button', { name: /sign in to q app/i })).toBeHidden();
    
    await page.goto('/app?paypal=failed');
    
    await expect(page.getByText(/subscription/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});