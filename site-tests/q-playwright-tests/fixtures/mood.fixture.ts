import { test as base } from '@playwright/test';

type MoodFixtures = {
  saveMood: (mood: string) => Promise<void>;
};

export const test = base.extend<MoodFixtures>({
  saveMood: async ({ page }, use) => {
    await use(async (mood: string) => {
      await page.goto('/mood');

      await page.click(`[data-mood="${mood}"]`);

      await page.getByRole('button', {
        name: /save/i
      }).click();
    });
  }
});

export { expect } from '@playwright/test';