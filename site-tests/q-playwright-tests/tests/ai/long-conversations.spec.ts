import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Long Conversations', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('handles multiple consecutive messages', async ({ page, loginAsUser }) => {
    await page.addInitScript(() => localStorage.setItem('q_chat_history_v1', JSON.stringify(Array.from({ length: 10 }, (_, index) => ({ id: `message-${index}`, sender: 'user', text: `Message ${index + 1}`, timestamp: '12:00' }))));
    await loginAsUser();
    await expect(page.getByText('Message 10')).toBeVisible();
  });

  test('conversation remains responsive', async ({ page, loginAsUser }) => {
    await page.addInitScript(() => localStorage.setItem('q_chat_history_v1', JSON.stringify(Array.from({ length: 20 }, (_, index) => ({ id: `test-${index}`, sender: 'user', text: `Test ${index + 1}`, timestamp: '12:00' }))));
    await loginAsUser();
    await expect(page.getByPlaceholder(/ask q about healthcare/i)).toBeEnabled();
  });
});
