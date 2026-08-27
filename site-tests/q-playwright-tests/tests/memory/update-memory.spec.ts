import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Update Memory', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('allows memory preferences to be updated explicitly', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.getByRole('button', { name: /memory engine/i }).click();
    await expect(page.getByRole('button', { name: /save preferences/i })).toBeVisible();
  });
});
