import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';
import { getPayPalTestVariable } from '../../helpers/paypal.helper';

test.describe('PayPal Monthly Plan', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test.skip(!getPayPalTestVariable('PLAN_ID_MONTHLY'), 'PayPal monthly plan is not configured');
  test('offers monthly billing', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByRole('heading', { name: 'Monthly' })).toBeVisible();
  });
});
