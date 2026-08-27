import { test, expect } from '../../fixtures/auth.fixture';

test.describe('AI Context Memory', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');
  test('context memory is explicit opt-in', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.getByRole('button', { name: /memory engine/i }).click();
    await expect(page.getByText(/opt-in ai context memory/i)).toBeVisible();
    await expect(page.getByRole('checkbox')).toBeVisible();
  });

  test('conversation history remains visible', async ({ page, loginAsUser }) => {
    await page.addInitScript(() => localStorage.setItem('q_chat_history_v1', JSON.stringify([{ id: 'memory-test', sender: 'user', text: 'Test memory', timestamp: '12:00' }])));
    await loginAsUser();
    await expect(page.getByText('Test memory')).toBeVisible();
  });
});
