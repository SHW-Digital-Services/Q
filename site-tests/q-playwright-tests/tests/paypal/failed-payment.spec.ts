import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Failed PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('returns failed checkout attempts to a safe subscription screen', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.goto('/app?paypal=failed');
    await expect(page.getByRole('heading', { name: 'Q Subscription' })).toBeVisible();
    await expect(page.getByText(/q does not handle card details/i)).toBeVisible();
  });
});
