import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Login', () => {
  test('shows login controls', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('not-a-user@example.com', 'invalid-password');
    await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible();
  });
});
