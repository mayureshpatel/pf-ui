import {Page} from '@playwright/test';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/**
 * Reads the JWT that global-setup seeded into localStorage. The `request` fixture doesn't share
 * a page's localStorage (this app authenticates via a bearer token, not cookies), so API calls
 * made outside of `page`'s own navigations need this passed explicitly as an Authorization header.
 */
export async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('pf_auth_token'));
  if (!token) {
    throw new Error("No 'pf_auth_token' in localStorage -- call page.goto() to a same-origin URL first.");
  }
  return token;
}

/**
 * Creates a fresh, uniquely-named account via the real API (not raw SQL) so each spec run gets
 * its own isolated data and repeated runs against a persistent dev DB don't accumulate cruft on
 * a shared fixture. Returns the exact name too -- it embeds a timestamp, so don't try to
 * reconstruct it from the id alone (both are just numbers and can collide on a prefix match).
 */
export async function createTestAccount(page: Page, namePrefix: string): Promise<{id: number; name: string}> {
  const token = await getAuthToken(page);
  const name = `${namePrefix} ${Date.now()}`;

  const response = await page.request.post(`${API_URL}/accounts`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {
      name,
      type: 'CHECKING',
      startingBalance: 1000,
      currencyCode: 'USD',
      bankName: 'STANDARD'
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test account: ${response.status()} ${await response.text()}`);
  }

  const id = (await response.json()) as number;
  return {id, name};
}
