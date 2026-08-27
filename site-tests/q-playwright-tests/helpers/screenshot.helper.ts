import { Page } from '@playwright/test';

export class ScreenshotHelper {
  static async capture(
    page: Page,
    name: string
  ) {
    await page.screenshot({
      path: `reports/screenshots/${name}.png`,
      fullPage: true
    });
  }
}