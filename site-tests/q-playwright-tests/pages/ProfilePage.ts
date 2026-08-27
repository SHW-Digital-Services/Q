import { Page } from '@playwright/test';

export class ProfilePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/profile');
  }

  async updateDisplayName(name: string) {
    await this.page.fill(
      'input[name="displayName"]',
      name
    );
  }
}