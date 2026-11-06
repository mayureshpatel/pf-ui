import { expect, test } from './fixtures/test';
import { registerTestUser } from './helpers/api';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/** The body the backend sends for an expired access token. */
const EXPIRED = {
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ detail: 'JWT token expired', status: 401 }),
};

test.describe('Session renewal (PF-899)', () => {
  test('a reload restores the session from the refresh cookie', async ({ page }) => {
    await page.goto('/dashboard');

    const refreshed = page.waitForRequest((request) => request.url().endsWith('/auth/refresh'));
    await page.reload();

    await refreshed;
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an expired access token renews silently and the request is replayed', async ({ page }) => {
    await page.goto('/dashboard');

    // the first transactions request sees an expired token, every later one goes through
    let failed = false;
    await page.route(/\/api\/v1\/transactions(\?|$)/, async (route) => {
      if (!failed) {
        failed = true;
        await route.fulfill(EXPIRED);
      } else {
        await route.continue();
      }
    });
    const refreshed = page.waitForRequest((request) => request.url().endsWith('/auth/refresh'));

    await page.getByRole('link', { name: 'Transactions' }).first().click();

    await refreshed;
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('a revoked session returns to sign-in and back to the same page afterwards', async ({
    page,
  }) => {
    // a fresh user, so revoking its session cannot affect the shared cached login
    const { username, password } = await registerTestUser(page);

    // end the session on the server, then make the next request look expired so the app has to renew
    expect((await page.request.post(`${API_URL}/auth/logout`)).status()).toBe(204);
    let failed = false;
    await page.route(/\/api\/v1\/accounts(\?|$)/, async (route) => {
      if (!failed) {
        failed = true;
        await route.fulfill(EXPIRED);
      } else {
        await route.continue();
      }
    });

    await page.getByRole('link', { name: 'Accounts' }).first().click();

    await expect(page).toHaveURL(/\/login\?returnUrl=.*accounts/);

    // id="password" lands on the <p-password> host element, not the inner native <input>
    await page.locator('#username').fill(username);
    await page.locator('#password input').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/accounts/);
  });
});
