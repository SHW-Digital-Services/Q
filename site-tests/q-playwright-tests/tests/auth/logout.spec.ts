import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Logout', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('ends the authenticated session', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).last().click();
    await expect(page.getByRole('button', { name: /sign in to q app/i })).toBeVisible({
      timeout: 15_000
    });
  });
});
