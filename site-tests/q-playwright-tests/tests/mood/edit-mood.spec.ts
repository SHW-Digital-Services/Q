import { test, expect } from '../../fixtures/auth.fixture';
import { openAppTab } from '../../helpers/app.helper';

test.describe('Edit Mood', () => {
  test.skip(!process.env.FREE_USER_EMAIL, 'Test user credentials are required');

  test('allows the current mood selection to change', async ({ page, loginAsUser }) => {
    await loginAsUser();
    
    // Wait for login to finish
    await expect(page.getByText(/Private Journal/i).first()).toBeVisible();
    await openAppTab(page, 'Private Journal');

    const mood = page.getByRole('button', { name: /okay.*3\/5/i });
    await mood.click();

    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  });
});
