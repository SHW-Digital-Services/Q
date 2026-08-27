import { Page } from '@playwright/test';

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin');
  }

  async openUsers() {
    await this.page.goto('/admin/users');
  }

  async openSubscriptions() {
    await this.page.goto('/admin/subscriptions');
  }
}