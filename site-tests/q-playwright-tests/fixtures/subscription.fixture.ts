import { test as base } from '@playwright/test';

type SubscriptionFixtures = {
  goToPricing: () => Promise<void>;
};

export const test = base.extend<SubscriptionFixtures>({
  goToPricing: async ({ page }, use) => {
    await use(async () => {
      await page.goto('/pricing');
    });
  }
});

export { expect } from '@playwright/test';