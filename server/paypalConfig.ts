export type PayPalEnvironment = 'live' | 'sandbox';

export interface PayPalConfig {
  environment: PayPalEnvironment;
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
  monthlyPlanId?: string;
  yearlyPlanId?: string;
}

export function getPayPalEnvironment(): PayPalEnvironment {
  return process.env.PAYPAL_ENV?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
}

export function getPayPalConfig(): PayPalConfig {
  const environment = getPayPalEnvironment();
  const prefix = `PAYPAL_${environment.toUpperCase()}`;

  return {
    environment,
    baseUrl: environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com',
    clientId: process.env[`${prefix}_CLIENT_ID`] || process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || process.env.PAYPAL_CLIENT_SECRET,
    webhookId: process.env[`${prefix}_WEBHOOK_ID`] || process.env.PAYPAL_WEBHOOK_ID,
    monthlyPlanId: process.env[`${prefix}_PLAN_ID_MONTHLY`] || process.env.PAYPAL_PLAN_ID_MONTHLY,
    yearlyPlanId: process.env[`${prefix}_PLAN_ID_YEARLY`] || process.env.PAYPAL_PLAN_ID_YEARLY
  };
}

export function getPayPalVariableName(
  key: 'CLIENT_ID' | 'CLIENT_SECRET' | 'WEBHOOK_ID' | 'PLAN_ID_MONTHLY' | 'PLAN_ID_YEARLY'
): string {
  return `PAYPAL_${getPayPalEnvironment().toUpperCase()}_${key}`;
}
