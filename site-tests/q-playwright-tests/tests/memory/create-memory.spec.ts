import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Create Memory', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('exposes explicit opt-in memory controls', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.getByRole('button', { name: /memory engine/i }).click();
    await expect(page.getByText(/opt-in ai context memory/i)).toBeVisible();
  });
});
