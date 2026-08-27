import { test, expect } from '../../fixtures/auth.fixture';

test.describe('AI Responses', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('AI response area is available in the authenticated app', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await expect(page.getByRole('heading', { name: 'Q Intelligence' })).toBeVisible();
    await expect(page.getByPlaceholder(/ask q about healthcare/i)).toBeVisible();
  });
});
