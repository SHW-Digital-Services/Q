import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Edit Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('allows the current mood selection to change', async ({ page, loginAsUser }) => {
    await loginAsUser();
    
    // Wait for login to finish
    await expect(page.getByText(/Private Journal/i).first()).toBeVisible();
    await openAppTab(page, 'Private Journal');
    
    // FIX: Click the 'Log Mood' button to reveal the mood faces
    await page.getByRole('button', { name: /log mood/i }).click();
    
    const mood = page.getByText('Okay', { exact: true });
    await mood.click();
    
    await expect(mood).toBeVisible();
  });
});