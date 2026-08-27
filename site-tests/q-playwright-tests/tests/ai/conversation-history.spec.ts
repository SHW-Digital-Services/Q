import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Conversation History', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('history persists after reload', async ({ page, loginAsUser }) => {
    // 1. Actually log in using your fixture
    await loginAsUser();
    
    // 2. Wait for the chat input to be visible
    const input = page.locator('input[type="text"], textarea').first();
    await input.waitFor({ state: 'visible' });
    await input.fill('Persistent message');
    
    // 3. Set up the intercept BEFORE clicking send
    const saveResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/') && 
      response.request().method() === 'POST' &&
      response.status() === 200
    );
    
    await page.getByRole('button', { name: /send/i }).click();

    // 4. Instant UI update
    await expect(page.getByText('Persistent message')).toBeVisible();
    
    // 5. Wait for DB save, then reload
    await saveResponsePromise;
    await page.reload();

    // 6. Verify persistence
    await expect(page.getByText('Persistent message')).toBeVisible();
  });
});