import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('Subscription Upgrade', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('offers available plans through the authenticated subscription flow', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});
