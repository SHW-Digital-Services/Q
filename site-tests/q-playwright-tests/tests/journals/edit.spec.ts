import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Edit Journal Entry', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('keeps saved journal content visible', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByText(/total entries/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Entry' })).toBeVisible();
  });
});
