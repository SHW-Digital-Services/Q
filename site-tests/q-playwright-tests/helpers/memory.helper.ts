import { Page } from '@playwright/test';

export class MemoryHelper {
  constructor(private page: Page) {}

  async createMemory(
    text: string
  ) {
    await this.page.goto('/memory');

    await this.page.fill(
      'textarea',
      text
    );

    await this.page.getByRole(
      'button',
      { name: /save/i }
    ).click();
  }

  async deleteMemory(
    text: string
  ) {
    await this.page.locator(
      `text=${text}`
    ).click();

    await this.page.getByRole(
      'button',
      { name: /delete/i }
    ).click();
  }
}