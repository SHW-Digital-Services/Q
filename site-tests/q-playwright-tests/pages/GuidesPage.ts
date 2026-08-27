import { Page } from '@playwright/test';

export class GuidesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/guides');
  }

  async search(term: string) {
    await this.page.fill('input[type="search"]', term);
  }
}