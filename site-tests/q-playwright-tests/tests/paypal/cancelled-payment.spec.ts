import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Cancelled PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns the user safely from a cancelled checkout', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app');
    await page.goto('/app?paypal=cancelled');
    
    // FIX: Use getByText since the modal title isn't an actual HTML heading tag
    await expect(page.getByText('Subscription', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});