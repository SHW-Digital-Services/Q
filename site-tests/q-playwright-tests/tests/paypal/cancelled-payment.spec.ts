import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Cancelled PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  
  test('returns the user safely from a cancelled checkout', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.goto('/app?paypal=cancelled');
    
    // Updated heading name from 'Q Subscription' to 'Subscription'
    await expect(page.getByRole('heading', { name: 'Subscription', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});