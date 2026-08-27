import { test, expect } from '@playwright/test';

const invalidPayloads = [
  {},
  { message: '' },
  { message: '   ' },
  { message: null },
  { message: 42 },
  { message: [] },
  { message: {} },
  { messages: [] },
  { messages: 'invalid' },
  { prompt: 'x'.repeat(100_001) }
];

for (const [index, payload] of invalidPayloads.entries()) {
  test(`AI API rejects invalid payload ${index + 1}`, async ({ request }) => {
    const response = await request.post('/api/q-ai/chat', { data: payload });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
}
