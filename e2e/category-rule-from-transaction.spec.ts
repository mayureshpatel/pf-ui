import { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { trackRuleByKeyword } from './helpers/cleanup';
import {
  createTestAccount,
  createTestCategory,
  createTestCategoryRule,
  createTestTransaction,
  createTestTransactionExact,
  getAuthToken,
} from './helpers/api';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/** What one test seeded. Every description and keyword embeds the run's unique token. */
interface Seed {
  token: string;
  /** The keyword a user would type to cover all three coffee transactions. */
  sharedKeyword: string;
  accountId: number;
  /** Uncategorized, matched by no other rule. */
  plain: string;
  /** Uncategorized, also matched by the higher-priority rule. */
  conflicting: string;
  /** Already categorized. */
  categorized: string;
  target: { id: number; name: string };
  other: { id: number; name: string };
  higherKeyword: string;
}

const HIGHER_PRIORITY = 50;

/**
 * Creates an account, two subcategories, three transactions sharing the token (two uncategorized, one
 * categorized) and a higher-priority rule whose keyword matches exactly one of the uncategorized
 * ones. The page must already be on the app origin (for the auth token).
 */
async function seed(page: Page, token: string): Promise<Seed> {
  const account = await createTestAccount(page, 'E2E Rule Account');
  const parent = await createTestCategory(page, 'E2E Rule Parent');
  const target = await createTestCategory(page, 'E2E Rule Target', parent.id);
  const other = await createTestCategory(page, 'E2E Rule Other', parent.id);

  const plain = `E2E Rule ${token} COFFEE #101`;
  const conflicting = `E2E Rule ${token} COFFEE #202`;
  await createTestTransactionExact(page, account.id, plain, {
    amount: 4.5,
    transactionDate: '2026-01-10T00:00:00Z',
  });
  await createTestTransactionExact(page, account.id, conflicting, {
    amount: 5.5,
    transactionDate: '2026-01-11T00:00:00Z',
  });
  // createTestTransaction suffixes a timestamp to this description, so it is matched by prefix
  const categorized = await createTestTransaction(
    page,
    account.id,
    other.id,
    `E2E Rule ${token} COFFEE #303`,
    { amount: 6.5, transactionDate: '2026-01-12T00:00:00Z' },
  );

  const higherKeyword = `${token} COFFEE #202`;
  await createTestCategoryRule(page, other.id, higherKeyword, HIGHER_PRIORITY);

  return {
    token,
    sharedKeyword: `E2E Rule ${token} COFFEE`,
    accountId: account.id,
    plain,
    conflicting,
    categorized: categorized.description,
    target,
    other,
    higherKeyword,
  };
}

/** Opens Transactions over all time, narrowed to this test's rows with the search box. */
async function openTransactionsFor(page: Page, token: string): Promise<void> {
  await page.goto('/transactions');
  // the page keeps no cancellation: a slow response for an earlier filter overwrites the rows of a
  // later one. Let the unfiltered all-time load land before searching, so the search result is last.
  const allTime = page.waitForResponse(
    (response) =>
      response.url().includes('/transactions') &&
      !response.url().includes('description=') &&
      response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await allTime;
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  // the search is debounced: wait for the request that carries it, or the first assertions race the
  // unfiltered list of the whole account
  const filtered = page.waitForResponse(
    (response) =>
      response.url().includes('/transactions') &&
      response.url().includes(token) &&
      response.request().method() === 'GET',
  );
  await page.getByRole('searchbox', { name: 'Search description or merchant' }).fill(token);
  await filtered;
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** The table row that carries a transaction's "Create rule from ..." action. */
function rowOf(page: Page, description: string): Locator {
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: `Create rule from ${description}` }) });
}

function createRuleAction(page: Page, description: string): Locator {
  return page.getByRole('button', { name: `Create rule from ${description}` });
}

function matchRow(page: Page, text: string): Locator {
  return page.locator('app-rule-match-list [data-match-row]').filter({ hasText: text });
}

async function chooseCategory(page: Page, panel: Locator, categoryName: string): Promise<void> {
  await panel.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: categoryName }).click();
}

test.describe('Create a category rule from a transaction', () => {
  // every test seeds and cleans up its own data, but they share the one dev user; run them in order
  test.describe.configure({ mode: 'serial' });

  let token: string;

  // playwright requires an object pattern for the fixtures argument, even when none is used
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    token = `r${Date.now().toString(36)}${testInfo.testId.replace(/\W/g, '').slice(0, 6)}`;
  });

  test('from an uncategorized row: prefilled keyword, match preview with a conflict, saved without applying', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const data = await seed(page, token);
    await openTransactionsFor(page, token);

    try {
      await test.step('Filter to uncategorized: only the two uncategorized rows remain', async () => {
        await page.getByRole('tab', { name: /Needs a category/ }).click();
        await expect(createRuleAction(page, data.plain)).toBeVisible();
        await expect(createRuleAction(page, data.conflicting)).toBeVisible();
        // the categorized row's description carries a timestamp suffix: match it by token instead
        await expect(page.getByText(new RegExp(`${data.token} COFFEE #303`))).toHaveCount(0);
      });

      const panel = page.getByRole('complementary', { name: 'Create rule' });
      const keywords = panel.locator('#rule-keywords');

      await test.step('Open Create rule from the row: titled panel, keyword prefilled and focused', async () => {
        await createRuleAction(page, data.plain).click();
        await expect(panel).toBeVisible();
        await expect(panel.getByRole('heading', { name: 'Create rule' })).toBeVisible();
        await expect(keywords).toHaveValue(data.plain);
        await expect(keywords).toBeFocused();
        // the row's own match is the only one for its raw description
        await expect(page.locator('app-rule-match-list [data-match-row]')).toHaveCount(1);
      });

      await test.step('Widen the keyword to the shared prefix: three matches with a verdict each', async () => {
        await keywords.fill(data.sharedKeyword);
        const summary = page.getByTestId('match-summary');
        await expect(summary).toContainText('3 matches');
        await expect(summary).toContainText('1 will be categorized by this rule');
        await expect(summary).toContainText('1 would lose to another rule');
        await expect(summary).toContainText(
          '1 already categorized - Apply rules leaves them alone',
        );
        await expect(page.locator('app-rule-match-list [data-match-row]')).toHaveCount(3);

        await expect(matchRow(page, '#101')).toContainText('Will be categorized');
        await expect(matchRow(page, '#202')).toContainText(
          `Loses to "${data.higherKeyword}" (priority ${HIGHER_PRIORITY})`,
        );
        await expect(matchRow(page, '#303')).toContainText(
          'Already categorized - Apply rules leaves it alone',
        );
      });

      await test.step('Choose a category and add the rule: the panel closes, the page stays as it was', async () => {
        await chooseCategory(page, panel, data.target.name);
        await panel.getByRole('button', { name: 'Add rule' }).click();
        try {
          await expect(page.getByText('Rule added')).toBeVisible();
        } finally {
          // tracked even when the assertion above fails, so the rule never outlives the test
          await trackRuleByKeyword(page, data.sharedKeyword);
        }
        await expect(panel).toBeHidden();

        await expect(page.getByRole('tab', { name: /Needs a category/ })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(
          page.getByRole('searchbox', { name: 'Search description or merchant' }),
        ).toHaveValue(token);
        await expect(createRuleAction(page, data.plain)).toBeVisible();
        await expect(createRuleAction(page, data.conflicting)).toBeVisible();
      });

      await test.step('The rule was only stored: the matched transactions are still uncategorized', async () => {
        const response = await page.request.get(
          `${API_URL}/transactions?accountId=${data.accountId}&size=100`,
          { headers: { Authorization: `Bearer ${await getAuthToken(page)}` } },
        );
        expect(response.ok()).toBeTruthy();
        const rows = (
          (await response.json()) as {
            content: { description: string; category: { id: number } | null }[];
          }
        ).content;
        for (const description of [data.plain, data.conflicting]) {
          const row = rows.find((r) => r.description === description);
          expect(row, description).toBeDefined();
          expect(row?.category, description).toBeNull();
        }
      });

      await test.step('The rule exists, with the chosen category, and Settings lists it', async () => {
        const response = await page.request.get(`${API_URL}/category-rules`, {
          headers: { Authorization: `Bearer ${await getAuthToken(page)}` },
        });
        const rules = (await response.json()) as {
          keywords: string[];
          category: { id: number } | null;
          priority: number;
        }[];
        const created = rules.find((r) => r.keywords.includes(data.sharedKeyword));
        expect(created?.category?.id).toBe(data.target.id);
        expect(created?.priority).toBe(0);

        await page.goto('/settings?section=rules');
        await page.getByLabel('Search rules').fill(data.sharedKeyword);
        const row = page.locator('[data-rule-row]', { hasText: data.sharedKeyword });
        await expect(row).toContainText(data.target.name);
      });
    } finally {
      // tracked again at the end, so a save that landed after the toast check still gets cleaned up
      // (tracking is idempotent)
      await trackRuleByKeyword(page, data.sharedKeyword);
    }
  });

  test('from several selected rows: keyword starts empty and the selection is listed', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const data = await seed(page, token);
    await openTransactionsFor(page, token);

    await test.step('Select two rows', async () => {
      await rowOf(page, data.plain).getByRole('checkbox').click();
      await rowOf(page, data.conflicting).getByRole('checkbox').click();
      await expect(
        page.getByRole('region', { name: 'Bulk actions for 2 selected transactions' }),
      ).toBeVisible();
    });

    const panel = page.getByRole('complementary', { name: 'Create rule' });

    await test.step('Bulk bar Create rule: empty keyword, prompt, and the two selected rows', async () => {
      await page
        .getByRole('region', { name: 'Bulk actions for 2 selected transactions' })
        .getByRole('button', { name: 'Create rule' })
        .click();
      await expect(panel).toBeVisible();
      await expect(panel.locator('#rule-keywords')).toHaveValue('');
      await expect(panel.locator('#rule-keywords')).toBeFocused();
      await expect(
        panel.getByText('Type a keyword to see which transactions it would match'),
      ).toBeVisible();
      const selected = panel.getByRole('list', { name: 'Selected transactions' });
      await expect(selected.getByRole('listitem')).toHaveCount(2);
      await expect(selected).toContainText(data.plain);
      await expect(selected).toContainText(data.conflicting);
    });

    await test.step('Closing the untouched form keeps the selection', async () => {
      await panel.getByRole('button', { name: 'Close' }).click();
      await expect(panel).toBeHidden();
      await expect(
        page.getByRole('region', { name: 'Bulk actions for 2 selected transactions' }),
      ).toBeVisible();
    });
  });

  test('Settings: the Category rules form shows the match list while typing a keyword', async ({
    page,
  }) => {
    await page.goto('/settings?section=rules');
    const data = await seed(page, token);
    await page.reload();

    await page.getByRole('button', { name: 'Add rule' }).first().click();
    const panel = page.getByRole('complementary', { name: 'Add rule' });
    await panel.locator('#rule-keywords').fill(data.sharedKeyword);

    const list = page.locator('app-rule-match-list');
    await expect(list.getByTestId('match-summary')).toContainText('3 matches');
    await expect(list.locator('[data-match-row]')).toHaveCount(3);
    await expect(matchRow(page, '#202')).toContainText(`Loses to "${data.higherKeyword}"`);
    await expect(matchRow(page, '#303')).toContainText('Already categorized');
    // nothing is saved: no rule with the shared keyword exists
    const rules = await page.request.get(`${API_URL}/category-rules`, {
      headers: { Authorization: `Bearer ${await getAuthToken(page)}` },
    });
    expect(
      ((await rules.json()) as { keywords: string[] }[]).some((r) =>
        r.keywords.includes(data.sharedKeyword),
      ),
    ).toBe(false);
  });

  test('keyboard: focus lands in the keyword field and returns to the row action on Escape', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const data = await seed(page, token);
    await openTransactionsFor(page, token);

    const action = createRuleAction(page, data.plain);
    await expect(action).toBeVisible();
    await action.focus();
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary', { name: 'Create rule' });
    await expect(panel.locator('#rule-keywords')).toBeFocused();

    // a form nothing was typed into closes without a discard prompt
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(action).toBeFocused();
  });
});
