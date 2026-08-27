import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Guide Categories', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('displays category filters', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Life Guides');
    await expect(page.getByRole('button', { name: 'All Guides' })).toBeVisible();
  });
});
