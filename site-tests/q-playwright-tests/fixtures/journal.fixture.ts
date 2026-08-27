import { test as base } from '@playwright/test';

type JournalFixtures = {
  createJournalEntry: (content: string) => Promise<void>;
};

export const test = base.extend<JournalFixtures>({
  createJournalEntry: async ({ page }, use) => {
    await use(async (content: string) => {
      await page.goto('/journal');
      await page.fill('textarea', content);
      await page.getByRole('button', { name: /save/i }).click();
    });
  }
});

export { expect } from '@playwright/test';

