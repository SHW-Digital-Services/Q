import { Page } from '@playwright/test';

export class ChatPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/chat');
  }

  async sendMessage(message: string) {
    await this.page.fill('textarea', message);
    await this.page.keyboard.press('Enter');
  }
}