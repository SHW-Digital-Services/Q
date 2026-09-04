import { test, expect } from '@playwright/test';

const requiredHeaders = [
  ['x-content-type-options', /nosniff/i],
  ['referrer-policy', /no-referrer|strict-origin|same-origin/i],
  ['x-frame-options', /deny|sameorigin/i],
  ['permissions-policy', /.+/]
] as const;

for (const [header, expected] of requiredHeaders) {
  test(`Security header ${header} is configured`, async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()[header] ?? '').toMatch(expected);
  });
}

test('Modern browser isolation and CSP headers are present', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  expect(headers['content-security-policy'] ?? '').toContain("default-src 'self'");
  expect(headers['cross-origin-opener-policy'] ?? '').toBe('same-origin');
  expect(headers['cross-origin-resource-policy'] ?? '').toBe('same-origin');
});

const protectedEndpoints = [
  '/api/v1/admin/me',
  '/api/v1/admin/staff',
  '/api/v1/admin/crm/users',
  '/api/v1/admin/password-reset-requests',
  '/api/v1/admin/provider-insights',
  '/api/v1/admin/data-moat-export'
];

for (const endpoint of protectedEndpoints) {
  test(`Security rejects anonymous access to ${endpoint}`, async ({ request }) => {
    const response = await request.get(endpoint);
    expect([401, 403]).toContain(response.status());
  });
}

const sensitiveEndpoints = [
  '/api/v1/admin/me',
  '/api/billing/paypal/status',
  '/api/referrals/me',
  '/api/privacy/requests'
];

for (const endpoint of sensitiveEndpoints) {
  test(`Sensitive endpoint ${endpoint} is not cacheable`, async ({ request }) => {
    const response = await request.get(endpoint);
    expect(response.headers()['cache-control'] ?? '').toContain('no-store');
    expect(response.headers()['pragma'] ?? '').toContain('no-cache');
  });
}

test('Hosted AI responses are not cacheable', async ({ request }) => {
  const response = await request.post('/api/q-ai/chat', { data: {} });
  expect(response.headers()['cache-control'] ?? '').toContain('no-store');
  expect(response.headers()['pragma'] ?? '').toContain('no-cache');
});

test('Privacy lifecycle endpoints reject anonymous access and are not cacheable', async ({ request }) => {
  const response = await request.get('/api/privacy/requests');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control'] ?? '').toContain('no-store');
});

test('Account deletion requires the exact confirmation schema', async ({ request }) => {
  const response = await request.post('/api/privacy/deletion-requests', { data: { confirmation: 'delete', unexpected: true } });
  expect(response.status()).toBe(400);
});
