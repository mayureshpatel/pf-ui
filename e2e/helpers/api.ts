import {Page} from '@playwright/test';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/**
 * Reads the JWT that global-setup seeded into localStorage. The `request` fixture doesn't share
 * a page's localStorage (this app authenticates via a bearer token, not cookies), so API calls
 * made outside of `page`'s own navigations need this passed explicitly as an Authorization header.
 */
export async function getAuthToken(page: Page): Promise<string> {
  // Mirrors StorageService.getToken() exactly: `pf_storage_type` (always in localStorage) says
  // which storage the token itself lives in. global-setup's cached session is always 'local',
  // but a freshly-registered user (AuthService.register() hardcodes rememberMe: false) has its
  // token in sessionStorage instead -- reading localStorage unconditionally would silently miss it.
  const token = await page.evaluate(() => {
    const storageType = localStorage.getItem('pf_storage_type');
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    return storage.getItem('pf_auth_token');
  });
  if (!token) {
    throw new Error("No 'pf_auth_token' found in local/session storage -- call page.goto() to a same-origin URL first.");
  }
  return token;
}

/**
 * Registers a brand-new user through the real UI form (not an API shortcut -- there's no public
 * registration endpoint to call directly; the frontend's honeypot-guarded form is the only path)
 * and leaves the page authenticated as them. Useful for specs that need a guaranteed-clean slate
 * (e.g. dashboard aggregations) rather than fighting the shared dev user's months of accumulated
 * E2E data. Lands on `/dashboard` on success, matching registration.spec.ts's own verified flow.
 */
export async function registerTestUser(page: Page): Promise<{username: string; password: string}> {
  const unique = Date.now();
  const username = `e2e_${unique}`;
  const password = 'RealUserPass1!';

  await page.goto('/register');
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(`${username}@example.com`);
  await page.locator('#password input').fill(password);
  await page.locator('#confirmPassword input').fill(password);
  await page.getByRole('button', {name: 'Create Account'}).click();
  await page.waitForURL(/\/dashboard$/);

  return {username, password};
}

/**
 * Looks up an account by name via the real API. For specs that create an account through the UI
 * (the flow under test) but then need its real id for a follow-up API call -- every other
 * `createTestX` helper returns the id directly since it creates via API in the first place, but
 * there's no UI-driven equivalent, so this fills that one specific gap.
 */
export async function findAccountByName(page: Page, name: string): Promise<{id: number; name: string}> {
  const token = await getAuthToken(page);
  const response = await page.request.get(`${API_URL}/accounts`, {
    headers: {Authorization: `Bearer ${token}`}
  });

  if (!response.ok()) {
    throw new Error(`Failed to list accounts: ${response.status()} ${await response.text()}`);
  }

  const accounts: {id: number; name: string}[] = await response.json();
  const account = accounts.find((a) => a.name === name);
  if (!account) {
    throw new Error(`No account named "${name}" found via GET /accounts.`);
  }
  return account;
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
 * given account and category (`categoryId` is optional -- omit it for a deliberately
 * uncategorized transaction, e.g. to trigger the dashboard's UNCATEGORIZED action item). Returns
 * the exact description too -- it embeds a timestamp, so tests can assert against it directly
 * instead of re-deriving it from the id.
 *
 * `amount`/`transactionDate`/`type` default to the values every existing caller already relies
 * on, overridable for specs that need deterministic aggregation values (e.g. dashboard totals).
 */
export async function createTestTransaction(
  page: Page,
  accountId: number,
  categoryId: number | undefined,
  descriptionPrefix: string,
  options?: {amount?: number; transactionDate?: string; type?: 'EXPENSE' | 'INCOME' | 'TRANSFER'}
): Promise<{id: number; description: string}> {
  const token = await getAuthToken(page);
  const description = `${descriptionPrefix} ${Date.now()}`;

  const response = await page.request.post(`${API_URL}/transactions`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {
      accountId,
      categoryId,
      amount: options?.amount ?? 42.5,
      transactionDate: options?.transactionDate ?? '2026-01-15T00:00:00Z',
      description,
      type: options?.type ?? 'EXPENSE'
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test transaction: ${response.status()} ${await response.text()}`);
  }

  const id = (await response.json()) as number;
  return {id, description};
}

/**
 * Creates `count` accounts via the real API (`namePrefix` suffixed with an index), for spreading
 * a large batch of test transactions across via {@link createTestTransactionsBulk} -- see that
 * function's own doc comment for why a single shared account can't safely take fully-concurrent
 * writes.
 */
export async function createTestAccountsBulk(
  page: Page,
  namePrefix: string,
  count: number
): Promise<{id: number; name: string}[]> {
  const accounts: {id: number; name: string}[] = [];
  for (let i = 0; i < count; i++) {
    accounts.push(await createTestAccount(page, `${namePrefix} ${i}`));
  }
  return accounts;
}

/**
 * Creates `count` transactions via the real API, one per day counting back from `count - 1` days
 * ago through today, round-robined across `accountIds` and all sharing the same
 * category/description (so they normalize to one merchant and land in one category bucket,
 * regardless of which account each lands on). Fired in concurrent batches -- at `count` in the
 * thousands, a fully sequential loop is impractically slow for a single spec's setup.
 *
 * Round-robining across several accounts, rather than writing every transaction to one, is what
 * makes that concurrency safe: creating a transaction also updates its account's balance under
 * optimistic locking, so a batch of simultaneous writes to the *same* account row spuriously
 * 409s -- spreading them across distinct accounts means no two concurrent requests ever contend
 * for the same row. The very first transaction is still created alone, ahead of the rest: merchant
 * find-or-create has the same shape of race (a batch of brand-new requests for the same not-yet-
 * existing merchant name all race to insert it, and all but one lose to
 * `idx_merchants_user_original_name`) but isn't per-account, so round-robining accounts alone
 * doesn't fix it -- only serializing the one request that actually creates the merchant does.
 *
 * Built for PF-823's row-cap regression coverage (Reports silently dropped everything past the
 * newest 1000 matching transactions) -- `count` should comfortably exceed that to be meaningful.
 */
export async function createTestTransactionsBulk(
  page: Page,
  accountIds: number[],
  categoryId: number,
  descriptionPrefix: string,
  count: number,
  amount: number
): Promise<void> {
  const token = await getAuthToken(page);
  const today = new Date();
  const batchSize = 20;

  const dateFor = (dayIndex: number): string => {
    const date = new Date(today);
    date.setDate(date.getDate() - (count - 1 - dayIndex));
    return date.toISOString().split('T')[0];
  };

  const createOne = async (dayIndex: number) => page.request.post(`${API_URL}/transactions`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {
      accountId: accountIds[dayIndex % accountIds.length],
      categoryId,
      amount,
      transactionDate: `${dateFor(dayIndex)}T00:00:00Z`,
      description: descriptionPrefix,
      type: 'EXPENSE'
    }
  });

  const first = await createOne(0);
  if (!first.ok()) {
    throw new Error(`Failed to bulk-create test transaction: ${first.status()} ${await first.text()}`);
  }

  for (let batchStart = 1; batchStart < count; batchStart += batchSize) {
    const batch = Array.from(
      {length: Math.min(batchSize, count - batchStart)},
      (_, i) => createOne(batchStart + i)
    );

    const responses = await Promise.all(batch);
    for (const response of responses) {
      if (!response.ok()) {
        throw new Error(`Failed to bulk-create test transaction: ${response.status()} ${await response.text()}`);
      }
    }
  }
}
