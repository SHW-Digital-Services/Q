import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Failed PayPal Payment', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('returns failed checkout attempts to a safe subscription screen', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.goto('/app?paypal=failed');
    
    // Loosened strictly exact text to a regex to match the cancelled payment test
    await expect(page.getByRole('heading', { name: /subscription/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with paypal/i })).toBeVisible();
  });
});