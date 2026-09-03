import { Page } from '@playwright/test';

export function getPayPalTestVariable(key: 'PLAN_ID_MONTHLY' | 'PLAN_ID_YEARLY'): string | undefined {
  const environment = process.env.PAYPAL_ENV?.trim().toLowerCase() === 'live' ? 'LIVE' : 'SANDBOX';
  return process.env[`PAYPAL_${environment}_${key}`] || process.env[`PAYPAL_${key}`];
}

export class PayPalHelper {
  constructor(private page: Page) {}

  async startCheckout() {
    await this.page.getByText(/subscribe/i).first().click();
  }

  async verifyRedirect() {
    return /paypal\.com/i.test(this.page.url());
  }
}
