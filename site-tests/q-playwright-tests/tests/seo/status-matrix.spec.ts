import { test, expect } from '@playwright/test';

const publicRoutes = [
  '/',
  '/app',
  '/legal/privacy',
  '/legal/terms',
  '/legal/security',
  '/legal/cookie',
  '/legal/community'
];

for (const route of publicRoutes) {
  test(`SEO route ${route} returns a non-error response`, async ({ request }) => {
    const response = await request.get(route);
    expect(response.status()).toBeLessThan(400);
  });
}
