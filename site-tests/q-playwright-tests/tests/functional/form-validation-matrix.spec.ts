import { test, expect } from '@playwright/test';

const invalidEmails = [
  'plainaddress',
  '@missing-local.test',
  'missing-domain@',
  'spaces in@email.test',
  'double@@email.test',
  'name@example test',
  'name domain@example.test',
  'name@example..test'
];

for (const email of invalidEmails) {
  test(`Functional validation rejects email: ${email}`, async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"]').first();

    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill('ValidTestPassword123!');
    await page.getByRole('button', { name: /Sign In to Q App/i }).click();

    expect(await emailInput.evaluate(input => (input as HTMLInputElement).validity.valid))
      .toBeFalsy();
  });
}

const shortPasswords = ['', '1', '12345'];

for (const password of shortPasswords) {
  test(`Functional validation rejects password length ${password.length}`, async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    const passwordInput = page.locator('input[type="password"]');

    await page.locator('input[type="email"]').first().fill('valid@example.test');
    await passwordInput.fill(password);
    await page.getByRole('button', { name: /Sign In to Q App/i }).click();

    expect(await passwordInput.evaluate(input => (input as HTMLInputElement).validity.valid))
      .toBeFalsy();
  });
}
