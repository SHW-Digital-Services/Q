import { Page } from '@playwright/test';

export class AdminHelper {
  constructor(private page: Page) {}

  async openDashboard() {
    await this.page.goto('/admin');
  }

  async openUsers() {
    await this.page.goto(
      '/admin/users'
    );
  }

  async openSubscriptions() {
    await this.page.goto(
      '/admin/subscriptions'
    );
  }
}