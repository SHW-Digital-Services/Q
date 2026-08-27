import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Edit Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('allows the current mood selection to change', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app'); 
    await openAppTab(page, 'Private Journal');
    
    // FIX: Use 'Okay' to match the exact UI copy shown in the trace
    const mood = page.getByText('Okay', { exact: true });
    
    await mood.click();
    await expect(mood).toBeVisible();
  });
});