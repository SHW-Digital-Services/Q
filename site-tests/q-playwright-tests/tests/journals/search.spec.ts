import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Journal Search', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays the journal archive summary', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByText(/last reflection/i)).toBeVisible();
  });
});
