import { test, expect } from '@playwright/test';

test.describe('Subscription API', () => {
  test('does not expose protected data without authentication', async ({ request }) => {
    const response = await request.get('/api/billing/subscription');

    expect([400, 401, 403, 404, 405]).toContain(response.status());
  });

  test('returns JSON for an unauthenticated request', async ({ request }) => {
    const response = await request.get('/api/billing/subscription');
    const contentType = response.headers()['content-type'] ?? '';

    expect(contentType).toContain('application/json');
  });
});
