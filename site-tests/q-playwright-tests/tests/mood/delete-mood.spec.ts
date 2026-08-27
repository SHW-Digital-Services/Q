import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Delete Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('does not claim an unsupported destructive mood-history action', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByRole('button', { name: /delete mood/i })).toHaveCount(0);
    await expect(page.getByText(/track emotional balance offline/i)).toBeVisible();
  });
});
