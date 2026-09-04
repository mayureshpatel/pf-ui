import {expect, test} from '@playwright/test';

/**
 * Covers the flow PF-183 fixed: self-service registration was completely broken (the backend
 * required ROLE_ADMIN, but the frontend's public "Create account" page assumed anonymous access
 * worked) -- every real user's signup attempt 403'd. Now restored, with a honeypot field guarding
 * against unsophisticated bots instead of the removed admin gate.
 */
test.describe('Registration -> Dashboard', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('a new user can register and lands on the dashboard', async ({page}) => {
    const unique = Date.now();
    const username = `e2e_reg_${unique}`;
    const email = `e2e_reg_${unique}@example.com`;
    const password = 'RealUserPass1!';

    await page.goto('/register');

    await page.locator('#username').fill(username);
    await page.locator('#email').fill(email);
    await page.locator('#password input').fill(password);
    await page.locator('#confirmPassword input').fill(password);
    // Honeypot (#website) deliberately left untouched -- a real user never sees or fills it.
    await page.getByRole('button', {name: 'Create Account'}).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('registering with an already-taken username shows a clear error, not a generic one', async ({page}) => {
    const unique = Date.now();
    const username = `e2e_reg_dup_${unique}`;
    const password = 'RealUserPass1!';

    // First registration succeeds and lands on the dashboard.
    await page.goto('/register');
    await page.locator('#username').fill(username);
    await page.locator('#email').fill(`${username}@example.com`);
    await page.locator('#password input').fill(password);
    await page.locator('#confirmPassword input').fill(password);
    await page.getByRole('button', {name: 'Create Account'}).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Second registration with the same username, from a fresh unauthenticated context.
    // AuthService.register() hardcodes rememberMe: false, so the session token landed in
    // sessionStorage, not localStorage -- both need clearing or guestGuard still sees an
    // active session and redirects /register straight back to /dashboard.
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/register');
    await page.locator('#username').fill(username);
    await page.locator('#email').fill(`different_${unique}@example.com`);
    await page.locator('#password input').fill(password);
    await page.locator('#confirmPassword input').fill(password);
    await page.getByRole('button', {name: 'Create Account'}).click();

    await expect(page.getByText('Username already exists')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});
