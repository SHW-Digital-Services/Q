import { test, expect } from '@playwright/test';

test.describe('Direct URL Access', () => {
  test('does not expose admin data through the direct URL', async ({
    page,
    request
  }) => {
    const response = await page.goto('/admin', {
      waitUntil: 'domcontentloaded'
    });

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Customer CRM|Admin Dashboard/i })
    ).toHaveCount(0);

    const protectedResponse = await request.get('/api/v1/admin/me');
    expect(protectedResponse.status()).toBe(401);
  });
});
