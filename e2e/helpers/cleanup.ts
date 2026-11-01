import { APIRequestContext, BrowserContext, Page } from '@playwright/test';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/** What a spec can create and that the cleanup knows how to delete. */
export type CreatedKind = 'transaction' | 'budget' | 'tag' | 'category' | 'merchant' | 'account';

interface Created {
  kind: CreatedKind;
  id: number;
}

/** Everything one test created, keyed by its browser context (a test's pages share one). */
const created = new WeakMap<BrowserContext, Created[]>();

/**
 * Remembers a row a test created, so the `test` fixture in `fixtures/test.ts` deletes it after the
 * test whether it passed or failed. The `createTestX` helpers call this themselves.
 */
export function track(page: Page, kind: CreatedKind, id: number): void {
  const list = created.get(page.context()) ?? [];
  list.push({ kind, id });
  created.set(page.context(), list);
}

/** Reads and forgets what a context created. */
export function takeTracked(context: BrowserContext): Created[] {
  const list = created.get(context) ?? [];
  created.delete(context);
  return list;
}

/** The shared user's token from the context's saved session, or null (a freshly registered user keeps its own, discarded with the context). */
async function sharedUserToken(context: BrowserContext): Promise<string | null> {
  const state = await context.storageState();
  for (const origin of state.origins) {
    const find = (key: string) => origin.localStorage.find((item) => item.name === key)?.value;
    if (find('pf_storage_type') === 'local' && find('pf_auth_token'))
      return find('pf_auth_token') ?? null;
  }
  return null;
}

async function remove(
  request: APIRequestContext,
  headers: Record<string, string>,
  path: string,
): Promise<void> {
  await request.delete(`${API_URL}/${path}`, { headers }).catch(() => undefined);
}

/**
 * Deletes what a test created, in an order the API accepts: every transaction on a tracked account
 * (and each tracked transaction) first, then budgets, tags, categories (children before their
 * parents), merchants, and accounts last (an account with transactions is refused). Best effort: a
 * failure here must never hide the test's own result, so every call swallows its error.
 */
export async function cleanupTracked(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<void> {
  const items = takeTracked(context);
  if (items.length === 0) return;
  const token = await sharedUserToken(context);
  if (!token) return;
  const headers = { Authorization: `Bearer ${token}` };
  const ids = (kind: CreatedKind) =>
    items.filter((item) => item.kind === kind).map((item) => item.id);

  const bulkDelete = (transactionIds: number[]) =>
    request
      .delete(`${API_URL}/transactions/bulk`, { headers, data: transactionIds })
      .catch(() => undefined);
  const tracked = ids('transaction');
  if (tracked.length > 0) await bulkDelete(tracked);
  // an account can hold more than one page of transactions (the bulk-cap spec seeds 1,200), so go page by page until it is empty
  for (const accountId of ids('account')) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const listed = await request
        .get(`${API_URL}/transactions?accountId=${accountId}&size=1000`, { headers })
        .catch(() => null);
      if (!listed?.ok()) break;
      const rows = ((await listed.json()) as { content: { id: number }[] }).content;
      if (rows.length === 0) break;
      await bulkDelete(rows.map((row) => row.id));
    }
  }

  for (const id of ids('budget')) await remove(request, headers, `budgets/${id}`);
  for (const id of ids('tag')) await remove(request, headers, `tags/${id}`);
  // a category created later is a child of one created earlier, so delete newest first
  for (const id of ids('category').reverse()) await remove(request, headers, `categories/${id}`);
  for (const id of ids('merchant')) await remove(request, headers, `merchants/${id}`);
  for (const id of ids('account')) await remove(request, headers, `accounts/${id}`);
}

/**
 * Like {@link track}, for a row the test made through the UI and so only knows by name: finds it
 * through the API now (the name must embed a timestamp so it is unique) and tracks its id. Call it
 * right after the UI step that creates the row, before anything that could fail.
 */
export async function trackByName(
  page: Page,
  kind: 'account' | 'merchant' | 'tag',
  name: string,
): Promise<void> {
  const token = await sharedUserToken(page.context());
  if (!token) return;
  const path = { account: 'accounts', merchant: 'merchants', tag: 'tags' }[kind];
  const response = await page.request
    .get(`${API_URL}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => null);
  if (!response?.ok()) return;
  const body = (await response.json()) as
    { id: number; name: string }[] | { content: { id: number; name: string }[] };
  const rows = Array.isArray(body) ? body : body.content;
  const match = rows.find((row) => row.name === name);
  if (match) track(page, kind, match.id);
}
