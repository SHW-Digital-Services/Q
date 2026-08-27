import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Conversation History', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('messages appear in history', async ({ page, loginAsUser }) => {
    await page.addInitScript(() => localStorage.setItem('q_chat_history_v1', JSON.stringify([{ id: 'history-test', sender: 'user', text: 'History test', timestamp: '12:00' }])));
    await loginAsUser();
    await expect(page.getByText('History test')).toBeVisible();
  });

  test('history persists after reload', async ({ page, loginAsUser }) => {
    await page.addInitScript(() => localStorage.setItem('q_chat_history_v1', JSON.stringify([{ id: 'persistent-test', sender: 'user', text: 'Persistent message', timestamp: '12:00' }])));
    await loginAsUser();
    await page.reload();
    await expect(page.getByText('Persistent message')).toBeVisible();
  });
});
