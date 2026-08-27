import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app');
  }

  async login(email: string, password: string) {
    await this.page.locator('input[type="email"]').first().fill(email);
    await this.page.locator('input[type="password"]').fill(password);
    await this.page.getByRole('button', { name: /sign in to q app/i }).click();
  }
}
