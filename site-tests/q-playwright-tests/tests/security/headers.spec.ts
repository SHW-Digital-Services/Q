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

