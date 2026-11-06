import { APIRequestContext, BrowserContext, Page } from '@playwright/test';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/** What a spec can create and that the cleanup knows how to delete. */
export type CreatedKind =
  'transaction' | 'budget' | 'tag' | 'category' | 'merchant' | 'account' | 'rule' | 'merchant-rule';

interface Created {
  kind: CreatedKind;
  id: number;
}

/** A transaction as the list endpoint returns it, as far as the cleanup reads it. */
interface ListedTransaction {
  id: number;
  account?: { id: number } | null;
}

/** Everything one test created, keyed by its browser context (a test's pages share one). */
const created = new WeakMap<BrowserContext, Created[]>();

/**
 * Remembers a row a test created (once, however often it is called), so the `test` fixture in `fixtures/test.ts` deletes it after the
 * test whether it passed or failed. The `createTestX` helpers call this themselves.
 */
export function track(page: Page, kind: CreatedKind, id: number): void {
  const list = created.get(page.context()) ?? [];
  // tracking the same row twice is harmless: it is deleted once
  if (list.some((item) => item.kind === kind && item.id === id)) return;
  list.push({ kind, id });
  created.set(page.context(), list);
}

/** Reads and forgets what a context created. */
export function takeTracked(context: BrowserContext): Created[] {
  const list = created.get(context) ?? [];
  created.delete(context);
  return list;
}

/** A fresh access token for the context's session (exchanged from the refresh cookie, PF-899), or null when the context has no valid session. */
async function sharedUserToken(context: BrowserContext): Promise<string | null> {
  const response = await context.request.post(`${API_URL}/auth/refresh`).catch(() => null);
  if (!response?.ok()) return null;
  return ((await response.json()) as { token: string }).token;
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
 * (and each tracked transaction) first, then category rules, budgets, tags, categories (children before their
 * parents), merchant rules, merchants, and accounts last (an account with transactions is refused). Best effort: a
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
      const rows = ((await listed.json()) as { content?: ListedTransaction[] }).content ?? [];
      // the shared user is real: delete only rows that say they are on this account, so an
      // ignored filter (or a response without account info) deletes nothing instead of everything
      const own = rows.filter((row) => row.account?.id === accountId);
      if (own.length === 0) break;
      await bulkDelete(own.map((row) => row.id));
    }
  }

  // a rule references its category, so rules go before categories
  for (const id of ids('rule')) await remove(request, headers, `category-rules/${id}`);
  for (const id of ids('budget')) await remove(request, headers, `budgets/${id}`);
  for (const id of ids('tag')) await remove(request, headers, `tags/${id}`);
  // a category created later is a child of one created earlier, so delete newest first
  for (const id of ids('category').reverse()) await remove(request, headers, `categories/${id}`);
  // a merchant rule references its merchant (deleting the merchant would cascade, but a failed run must not rely on it)
  for (const id of ids('merchant-rule')) await remove(request, headers, `merchant-rules/${id}`);
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

/**
 * Like {@link trackByName}, for a category rule the test made through the UI: finds it through the
 * API by one of its keywords (which must embed a unique token) and tracks its id. Call it right after
 * the UI step that saves the rule, before anything that could fail.
 */
export async function trackRuleByKeyword(page: Page, keyword: string): Promise<void> {
  const token = await sharedUserToken(page.context());
  if (!token) return;
  const response = await page.request
    .get(`${API_URL}/category-rules`, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => null);
  if (!response?.ok()) return;
  const rules = (await response.json()) as { id: number; keywords: string[] }[];
  for (const rule of rules.filter((r) => r.keywords.includes(keyword)))
    track(page, 'rule', rule.id);
}

/**
 * Like {@link trackRuleByKeyword}, for a merchant rule the test made through the UI: finds it through
 * the API by one of its keywords (which must embed a unique token) and tracks its id.
 */
export async function trackMerchantRuleByKeyword(page: Page, keyword: string): Promise<void> {
  const token = await sharedUserToken(page.context());
  if (!token) return;
  const response = await page.request
    .get(`${API_URL}/merchant-rules`, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => null);
  if (!response?.ok()) return;
  const rules = (await response.json()) as { id: number; keywords: string[] }[];
  for (const rule of rules.filter((r) => r.keywords.includes(keyword)))
    track(page, 'merchant-rule', rule.id);
}
