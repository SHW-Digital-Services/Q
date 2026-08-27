import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('Subscription Plans', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('displays plans', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByText(/billed every month|no subscription plans available/i).first()).toBeVisible();
  });
});
