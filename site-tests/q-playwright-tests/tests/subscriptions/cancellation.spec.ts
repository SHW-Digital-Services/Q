import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('Subscription Cancellation', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('does not present an unimplemented local cancellation action', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByRole('button', { name: /cancel subscription/i })).toHaveCount(0);
    await expect(page.getByText(/secure recurring billing through paypal/i)).toBeVisible();
  });
});
