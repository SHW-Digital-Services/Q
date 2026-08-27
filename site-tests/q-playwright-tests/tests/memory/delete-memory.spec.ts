import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Delete Memory', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('explains that saved cloud memories can be removed', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByText(/you can remove them at any time/i)).toBeVisible();
  });
});
