import { Page } from '@playwright/test';

export class UsersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/users');
  }

  async searchUser(email: string) {
    await this.page.fill(
      'input[type="search"]',
      email
    );
  }
}