import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Logout', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('ends the authenticated session', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await expect(page).toHaveURL(/login|^\/$/);
  });
});
