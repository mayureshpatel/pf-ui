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

/**
 * Decodes the numeric user id out of the JWT payload's own `userId` claim, mirroring
 * `getUserFromToken` in `pf-ui`'s `jwt.utils.ts`. Needed because some create endpoints (tags
 * among them) require `userId` in the request body itself, not just derived server-side from the
 * `Authorization` header.
 */
async function getAuthenticatedUserId(page: Page): Promise<number> {
  const token = await getAuthToken(page);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8')) as {userId: number};
  return payload.userId;
}

/**
 * Creates a fresh, uniquely-named tag via the real API, mirroring `createTestAccount`.
 */
export async function createTestTag(page: Page, namePrefix: string): Promise<{id: number; name: string}> {
  const token = await getAuthToken(page);
  const userId = await getAuthenticatedUserId(page);
  const name = `${namePrefix} ${Date.now()}`;

  const response = await page.request.post(`${API_URL}/tags`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {name, color: '#3b82f6', userId}
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test tag: ${response.status()} ${await response.text()}`);
  }

  const id = (await response.json()) as number;
  return {id, name};
}

/**
 * Creates a fresh, uniquely-named category via the real API, mirroring `createTestAccount`. The
 * edit-transaction form's `category` field is `Validators.required` (silently blocks submit via
 * `markAllAsTouched()` otherwise, no toast/network call), so any transaction a test plans to
 * re-save through the UI needs a real category id up front -- a brand-new user has none seeded.
 */
export async function createTestCategory(
  page: Page,
  namePrefix: string,
  parentId?: number
): Promise<{id: number; name: string}> {
  const token = await getAuthToken(page);
  const userId = await getAuthenticatedUserId(page);
  const name = `${namePrefix} ${Date.now()}`;

  const response = await page.request.post(`${API_URL}/categories`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {name, userId, parentId}
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test category: ${response.status()} ${await response.text()}`);
  }

  const id = (await response.json()) as number;
  return {id, name};
}

/**
 * Creates a fresh, uniquely-named (via its description) transaction via the real API, on the
 * given account and category. Returns the exact description too -- it embeds a timestamp, so
 * tests can assert against it directly instead of re-deriving it from the id.
 */
export async function createTestTransaction(
  page: Page,
  accountId: number,
  categoryId: number,
  descriptionPrefix: string
): Promise<{id: number; description: string}> {
  const token = await getAuthToken(page);
  const description = `${descriptionPrefix} ${Date.now()}`;

  const response = await page.request.post(`${API_URL}/transactions`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {
      accountId,
      categoryId,
      amount: 42.5,
      transactionDate: '2026-01-15T00:00:00Z',
      description,
      type: 'EXPENSE'
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test transaction: ${response.status()} ${await response.text()}`);
  }

  const id = (await response.json()) as number;
  return {id, description};
}
