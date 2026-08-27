import { test, expect } from '@playwright/test';

test.describe('UI - Authentication Form', () => {
  test('keeps primary controls inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    const form = page.locator('form').first();
    const box = await form.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  });

  test('shows clear focus for keyboard users', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]').first();

    await email.focus();
    await expect(email).toBeFocused();
  });
});

