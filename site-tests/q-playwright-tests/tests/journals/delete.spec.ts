import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Delete Journal Entry', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays delete action for an existing entry', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await page.getByRole('button', { name: 'New Entry' }).click();
    await page.getByPlaceholder(/setting boundaries/i).fill('Delete control test');
    await page.getByPlaceholder(/write freely/i).fill('Disposable private entry');
    await page.getByRole('button', { name: /save private entry/i }).click();
    await expect(page.getByTitle('Delete Entry').first()).toBeVisible();
  });
});
