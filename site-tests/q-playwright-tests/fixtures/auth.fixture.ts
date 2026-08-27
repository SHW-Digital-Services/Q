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
      
      // Set up the listener for the Supabase auth response BEFORE triggering the login action
      const tokenResponse = page.waitForResponse(
        (response) => response.url().includes('/auth/v1/token') && response.status() === 200
      );

      // Execute the login steps (fill credentials and click sign in)
      await login.login(process.env.FREE_USER_EMAIL!, process.env.FREE_USER_PASSWORD!);
      
      // Block until the Supabase authentication is completely finished
      await tokenResponse;
      
      // Wait for the app to begin routing away from the login page
      await page.waitForURL('**/app**');
    });
  },
  loginAsAdmin: async ({ page }, use) => {
    await use(async () => {
      const login = new LoginPage(page);
      await login.goto();
      
      // Set up the listener for the Supabase auth response BEFORE triggering the login action
      const tokenResponse = page.waitForResponse(
        (response) => response.url().includes('/auth/v1/token') && response.status() === 200
      );

      // Execute the login steps (fill credentials and click sign in)
      await login.login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
      
      // Block until the Supabase authentication is completely finished
      await tokenResponse;
      
      // Wait for the app to begin routing away from the login page
      await page.waitForURL('**/app**'); // Adjust to '**/admin**' if admins are routed differently
    });
  }
});

export { expect } from '@playwright/test';