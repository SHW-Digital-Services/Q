import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Create Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays mood choices', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    await expect(page.getByRole('button', { name: /struggling/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /empowered/i })).toBeVisible();
  });
});
