import { Page } from '@playwright/test';

export class BillingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/billing');
  }

  async viewInvoices() {
    await this.page.getByText(/invoice/i).click();
  }
}