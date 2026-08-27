import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Rate Limits', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('chat remains available under normal use', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await expect(page.getByPlaceholder(/ask q about healthcare/i)).toBeEnabled();
  });

  test('rejects rapid malformed API requests without server errors', async ({ request }) => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => request.post('/api/q-ai/chat', { data: { message: '' } })));
    expect(responses.every(response => response.status() === 400)).toBeTruthy();
  });

  test('limits oversized request bodies', async ({ request }) => {
    const response = await request.post('/api/q-ai/chat', { data: { message: 'x'.repeat(100_001) } });
    expect(response.status()).toBe(413);
  });
});
