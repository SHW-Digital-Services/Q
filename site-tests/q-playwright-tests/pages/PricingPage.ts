import { Page } from '@playwright/test';

export class PricingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/pricing');
  }

  async selectMonthlyPlan() {
    await this.page.getByText(/monthly/i).click();
  }

  async selectAnnualPlan() {
    await this.page.getByText(/annual/i).click();
  }
}