import { Page } from '@playwright/test';

export class PayPalHelper {
  constructor(private page: Page) {}

  async startCheckout() {
    await this.page.getByText(/subscribe/i).first().click();
  }

  async verifyRedirect() {
    return /paypal\.com/i.test(this.page.url());
  }
}

