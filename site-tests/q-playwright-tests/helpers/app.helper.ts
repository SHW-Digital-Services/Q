import { expect, Page } from '@playwright/test';

export async function openAppTab(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).first().click();
}

export async function openSubscription(page: Page) {
  await page.getByRole('button', { name: 'Subscribe', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Q Subscription' })).toBeVisible();
}
