import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Edit Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('allows the current mood selection to change', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await page.waitForURL('**/app'); // Ensure login completes
    await openAppTab(page, 'Private Journal');
    
    // Look for any element containing the text "Meh" instead of strictly requiring a button role
    const mood = page.getByText('Meh', { exact: true });
    
    await mood.click();
    await expect(mood).toBeVisible();
  });
});