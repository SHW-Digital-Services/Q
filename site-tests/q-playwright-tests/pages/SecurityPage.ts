import { Page } from '@playwright/test';

export class SecurityPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/security');
  }

  async enableTwoFactor() {
    await this.page.getByText(/2fa/i).click();
  }
}