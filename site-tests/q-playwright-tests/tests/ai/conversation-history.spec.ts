import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Conversation History', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('history persists after reload', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app');
    
    const input = page.locator('input[type="text"], textarea').first();
    await input.waitFor({ state: 'visible' });
    await input.fill('Persistent message');
    
    const saveResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/') && 
      response.request().method() === 'POST' &&
      response.status() === 200
    );
    
    // FIX: Press 'Enter' instead of trying to find the icon button
    await input.press('Enter');

    await expect(page.getByText('Persistent message')).toBeVisible();
    
    await saveResponsePromise;
    await page.reload();

    await expect(page.getByText('Persistent message')).toBeVisible();
  });
});