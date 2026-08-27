import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

type AuthFixtures = {
  loginAsUser: () => Promise<void>;
  loginAsAdmin: () => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  loginAsUser: async ({ page }, use) => {
    await use(async () => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(process.env.FREE_USER_EMAIL!, process.env.FREE_USER_PASSWORD!);
    });
  },
  loginAsAdmin: async ({ page }, use) => {
    await use(async () => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
    });
  }
});

export { expect } from '@playwright/test';

