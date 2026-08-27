import { test, expect } from '@playwright/test';

const cases = [
  ['GET', '/api/not-a-real-route'],
  ['POST', '/api/q-ai'],
  ['GET', '/api/v1/admin/me'],
  ['GET', '/api/v1/admin/staff'],
  ['PATCH', '/api/v1/admin/site-settings/launch'],
  ['PATCH', '/api/v1/admin/users/missing/role'],
  ['GET', '/api/v1/admin/crm/users'],
  ['POST', '/api/referrals/invite'],
  ['POST', '/api/referrals/claim'],
  ['GET', '/api/referrals/me'],
  ['POST', '/api/billing/paypal/create-subscription'],
  ['GET', '/api/billing/paypal/status'],
  ['POST', '/api/billing/paypal/complete']
] as const;

for (const [method, endpoint] of cases) {
  test(`API handles anonymous ${method} ${endpoint}`, async ({ request }) => {
    const response = await request.fetch(endpoint, {
      method,
      data: {}
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');
  });
}

