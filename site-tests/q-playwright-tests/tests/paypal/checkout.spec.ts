import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('PayPal Checkout', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('shows a PayPal checkout action', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});
