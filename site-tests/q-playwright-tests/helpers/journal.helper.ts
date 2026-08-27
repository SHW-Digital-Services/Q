import { Page } from '@playwright/test';

export class JournalHelper {
  constructor(private page: Page) {}

  async createEntry(text: string) {
    await this.page.getByRole('button', { name: /private journal/i }).click();
    await this.page.locator('textarea').fill(text);
    await this.page.getByRole('button', { name: /save/i }).click();
  }
}

