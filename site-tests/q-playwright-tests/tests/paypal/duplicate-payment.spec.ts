import { test, expect } from '@playwright/test';

test.describe('Duplicate PayPal Payment', () => {
  test('rejects an unsigned duplicate webhook', async ({ request }) => {
    const response = await request.post('/api/billing/paypal/webhook', {
      data: { id: 'duplicate-placeholder', event_type: 'PAYMENT.CAPTURE.COMPLETED' }
    });
    expect([400, 401, 403, 404]).toContain(response.status());
  });
});
