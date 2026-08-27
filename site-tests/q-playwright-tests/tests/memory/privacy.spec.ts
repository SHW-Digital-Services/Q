import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Memory Privacy', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('displays privacy controls', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.getByRole('button', { name: /memory engine/i }).click();
    await expect(page.getByText(/allow q to recall pronouns and goals in chat/i)).toBeVisible();
    await expect(page.getByRole('checkbox')).toBeVisible();
  });
});
