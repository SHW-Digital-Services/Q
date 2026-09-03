import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';
import { getPayPalTestVariable } from '../../helpers/paypal.helper';

test.describe('PayPal Annual Plan', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test.skip(!getPayPalTestVariable('PLAN_ID_YEARLY'), 'PayPal yearly plan is not configured');
  test('offers annual billing', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByRole('heading', { name: 'Yearly' })).toBeVisible();
  });
});
