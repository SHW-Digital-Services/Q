import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Guides', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('displays guide cards', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Life Guides');
    await expect(page.getByRole('heading', { name: /q life navigators/i })).toBeVisible();
    await expect(page.getByText(/read progress/i).first()).toBeVisible();
  });
});
