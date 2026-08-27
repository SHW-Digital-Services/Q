import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('Subscription Entitlements', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays included subscription features', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    await expect(page.getByText('Private memory controls')).toBeVisible();
    await expect(page.getByText('Vetted knowledge access')).toBeVisible();
  });
});
