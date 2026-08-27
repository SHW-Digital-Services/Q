import { Page } from '@playwright/test';

export class ExperiencesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/experiences');
  }

  async search(term: string) {
    await this.page.fill('input[type="search"]', term);
  }
}