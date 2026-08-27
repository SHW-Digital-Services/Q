import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Conversation History', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('history persists after reload', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app');
    
    const input = page.locator('input[type="text"], textarea').first();
    await input.waitFor({ state: 'visible' });
    await input.fill('Persistent message');
    
    // Press 'Enter' instead of trying to click the SVG icon
    await input.press('Enter');

    await expect(page.getByText('Persistent message')).toBeVisible();
    
    // Wait for the optimistic UI save to reach Supabase before reloading
    await page.waitForTimeout(1500);
    
    await page.reload();

    await expect(page.getByText('Persistent message')).toBeVisible();
  });
});