import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Failed PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns failed checkout attempts to a safe subscription screen', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app');
    await page.goto('/app?paypal=failed');
    
    // FIX: Use getByText since the modal title isn't an actual HTML heading tag
    await expect(page.getByText('Subscription', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});