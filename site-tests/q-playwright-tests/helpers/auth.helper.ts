import { Page } from '@playwright/test';

export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/login');

    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);

    await this.page.getByRole('button', {
      name: /login|sign in/i
    }).click();
  }

  async logout() {
    await this.page.getByRole('button', {
      name: /logout|sign out/i
    }).click();
  }
}