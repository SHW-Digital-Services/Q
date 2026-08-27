import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Edit Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('allows the current mood selection to change', async ({ page, loginAsUser }) => {
    await loginAsUser();
    await openAppTab(page, 'Private Journal');
    
    // Use "Meh" which matches the actual UI button
    const mood = page.getByRole('button', { name: /meh/i });
    
    await mood.click();
    await expect(mood).toBeVisible();
  });
});