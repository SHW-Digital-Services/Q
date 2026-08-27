import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Mood History', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays mood history', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByText(/7-day trend/i)).toBeVisible();
  });
});
