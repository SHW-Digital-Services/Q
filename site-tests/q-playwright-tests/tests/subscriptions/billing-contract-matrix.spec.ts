import { test, expect } from '@playwright/test';

const anonymousBillingCases = [
  ['GET', '/api/billing/paypal/status'],
  ['POST', '/api/billing/paypal/create-subscription'],
  ['POST', '/api/billing/paypal/complete']
] as const;

for (const [method, endpoint] of anonymousBillingCases) {
  test(`Billing protects ${method} ${endpoint}`, async ({ request }) => {
    const response = await request.fetch(endpoint, {
      method,
      data: {}
    });
    expect([400, 401, 403]).toContain(response.status());
  });
}

const planKeys = ['monthly', 'yearly'] as const;

for (const plan of planKeys) {
  test(`Billing rejects anonymous ${plan} checkout`, async ({ request }) => {
    const response = await request.post(
      '/api/billing/paypal/create-subscription',
      { data: { plan } }
    );
    expect(response.status()).toBe(401);
  });
}

