import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Export Journal', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays the privacy-preserving PDF export action', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByRole('button', { name: /export pdf/i })).toBeVisible();
  });
});
