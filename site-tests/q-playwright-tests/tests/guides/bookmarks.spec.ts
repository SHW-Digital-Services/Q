import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Guide Bookmarks', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('displays bookmark', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Life Guides');
    await expect(page.getByRole('button', { name: /bookmark guide/i }).first()).toBeVisible();
  });
});
