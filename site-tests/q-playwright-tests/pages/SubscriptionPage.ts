import { Page } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings');
  }

  async saveSettings() {
    await this.page.getByRole('button', {
      name: /save/i
    }).click();
  }
}