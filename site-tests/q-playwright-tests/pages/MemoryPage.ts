import { Page } from '@playwright/test';

export class MemoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/memory');
  }

  async createMemory(text: string) {
    await this.page.fill('textarea', text);

    await this.page.getByRole('button', {
      name: /save/i
    }).click();
  }
}