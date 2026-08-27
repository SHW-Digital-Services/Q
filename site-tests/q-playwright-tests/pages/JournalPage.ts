import { Page } from '@playwright/test';

export class JournalPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/journal');
  }

  async createEntry(text: string) {
    await this.page.fill('textarea', text);
    await this.page.getByRole('button', { name: /save/i }).click();
  }
}

