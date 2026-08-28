import { test, expect } from '@playwright/test';

test.describe('PayPal Webhook', () => {
  test('rejects a webhook without a valid signature', async ({ request }) => {
    const response = await request.post('/api/billing/paypal/webhook', {
      data: { id: 'unsigned-placeholder', event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' }
    });
    expect([400, 401, 403, 404, 503]).toContain(response.status());
  });
});
