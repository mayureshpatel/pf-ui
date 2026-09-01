import {expect, test} from '@playwright/test';

/**
 * Proves the harness itself works: global-setup's cached session actually authenticates
 * the app, and the router's guards correctly branch on it. Business-flow coverage belongs
 * in PF-116, not here.
 */
test.describe('E2E harness', () => {
  test('an authenticated session lands on the dashboard, not the login page', async ({page}) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an authenticated session is redirected away from /login', async ({page}) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
