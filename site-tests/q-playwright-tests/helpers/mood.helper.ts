import { Page } from '@playwright/test';

export class MoodHelper {
  constructor(private page: Page) {}

  async saveMood(
    mood: string
  ) {
    await this.page.goto('/mood');

    await this.page.click(
      `[data-mood="${mood}"]`
    );

    await this.page.getByRole(
      'button',
      { name: /save/i }
    ).click();
  }
}