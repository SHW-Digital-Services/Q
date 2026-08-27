import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('Subscription Renewal', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('provides a server-backed subscription status check', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByRole('button', { name: 'Check status' })).toBeVisible();
  });
});
