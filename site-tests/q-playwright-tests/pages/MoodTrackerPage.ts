import { Page } from '@playwright/test';

export class MoodTrackerPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/mood');
  }

  async selectMood(mood: string) {
    await this.page.click(
      `[data-mood="${mood}"]`
    );
  }

  async save() {
    await this.page.getByRole('button', {
      name: /save/i
    }).click();
  }
}