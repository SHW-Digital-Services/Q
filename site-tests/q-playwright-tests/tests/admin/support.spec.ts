import { test, expect } from '@playwright/test';

test.describe('Admin Support access', () => {
  test('requires staff sign-in before showing management controls', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByRole('heading', { name: 'Q Customer Operations' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter CRM' })).toBeEnabled();
  });

  test('rejects anonymous access to management data', async ({ request }) => {
    const response = await request.get('/api/v1/admin/contact-requests');
    expect(response.status()).toBe(401);
  });
});
