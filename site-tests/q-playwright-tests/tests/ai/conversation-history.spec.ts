import { test, expect } from '@playwright/test';

test.describe('Conversation History', () => {
  test('history persists after reload', async ({ page }) => {
    // Assuming you have a standard setup/login step here
    await page.goto('/app');
    
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('Persistent message');
    
    // 1. Set up a listener for the outgoing chat API request BEFORE clicking
    // Adjust the URL string ('/api/') if your chat endpoint is named something specific like '/api/chat'
    const saveResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/') && 
      response.request().method() === 'POST' &&
      response.status() === 200
    );
    
    await page.getByRole('button', { name: /send/i }).click();

    // 2. The optimistic UI update happens instantly
    await expect(page.getByText('Persistent message')).toBeVisible();
    
    // 3. WAIT for the server to actually save the message before reloading
    await saveResponsePromise;

    await page.reload();

    // 4. Now the history will survive the reload
    await expect(page.getByText('Persistent message')).toBeVisible();
  });
});