import {expect, test} from '@playwright/test';

/**
 * Registration has its own spec (registration.spec.ts, added for PF-183) -- this file covers
 * logging in with a pre-existing user only.
 */
test.describe('Login -> Dashboard', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('a valid username/password reaches the dashboard', async ({page}) => {
    const username = process.env['E2E_USERNAME']!;
    const password = process.env['E2E_PASSWORD']!;

    await page.goto('/login');

    // id="password" lands on the <p-password> host element, not the inner native <input>.
    await page.locator('#username').fill(username);
    await page.locator('#password input').fill(password);
    await page.getByRole('button', {name: 'Sign In'}).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an invalid password shows the correct error, not a generic one', async ({page}) => {
    const username = process.env['E2E_USERNAME']!;

    await page.goto('/login');

    await page.locator('#username').fill(username);
    await page.locator('#password input').fill('definitely-the-wrong-password');
    await page.getByRole('button', {name: 'Sign In'}).click();

    await expect(page.getByText('Invalid username or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
