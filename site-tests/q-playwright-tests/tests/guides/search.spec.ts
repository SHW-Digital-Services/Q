import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Guide Search', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('displays search', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Life Guides');
    await expect(page.getByPlaceholder(/search guides or topics/i)).toBeVisible();
  });
});
