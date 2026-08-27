import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Create Journal Entry', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays entry editor', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await page.getByRole('button', { name: 'New Entry' }).click();
    await expect(page.getByPlaceholder(/write freely/i)).toBeVisible();
  });
});
