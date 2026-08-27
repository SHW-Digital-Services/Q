import { test as base } from './auth.fixture';

type AdminFixtures = {
  openAdminDashboard: () => Promise<void>;
};

export const test = base.extend<AdminFixtures>({
  openAdminDashboard: async ({ page }, use) => {
    await use(async () => {
      await page.goto('/admin');
    });
  }
});

export { expect } from '@playwright/test';