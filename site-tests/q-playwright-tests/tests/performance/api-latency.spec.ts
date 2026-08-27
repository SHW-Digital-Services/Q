import { test, expect } from '@playwright/test';

test.describe('Performance - Local API Latency', () => {
  test('serves launch settings within the local latency budget', async ({ request }) => {
    await request.get('/api/v1/admin/site-settings/launch');

    const startedAt = Date.now();
    const response = await request.get('/api/v1/admin/site-settings/launch');
    const elapsed = Date.now() - startedAt;

    expect(response.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(2_000);
  });
});

