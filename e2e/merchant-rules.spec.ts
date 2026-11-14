import { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { trackMerchantRuleByKeyword } from './helpers/cleanup';
import {
  createTestAccount,
  createTestDescriptionLink,
  createTestMerchant,
  createTestMerchantRule,
  createTestTransaction,
  createTestTransactionExact,
  getAuthToken,
} from './helpers/api';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/** A listed transaction, as far as the assertions read it. */
interface ListedTransaction {
  id: number;
  description: string;
  merchant: { id: number } | null;
}

/** The merchant of every transaction on an account, by description. */
async function merchantsByDescription(
  page: Page,
  accountId: number,
): Promise<Map<string, number | null>> {
  const response = await page.request.get(
    `${API_URL}/transactions?accountId=${accountId}&size=100`,
    { headers: { Authorization: `Bearer ${await getAuthToken(page)}` } },
  );
  expect(response.ok()).toBeTruthy();
  const rows = ((await response.json()) as { content: ListedTransaction[] }).content;
  return new Map(rows.map((row) => [row.description, row.merchant?.id ?? null]));
}

function matchRow(page: Page, text: string): Locator {
  return page.locator('app-rule-match-list [data-match-row]').filter({ hasText: text });
}

/** A Standard-format CSV statement built in memory, for `setInputFiles`. */
function statement(name: string, rows: [description: string, amount: string, date: string][]) {
  const lines = ['description,amount,date', ...rows.map((row) => row.join(','))];
  return { name, mimeType: 'text/csv', buffer: Buffer.from(`${lines.join('\n')}\n`) };
}

test.describe('Merchant rules', () => {
  // every test seeds and cleans up its own data, but they share the one dev user; run them in order
  test.describe.configure({ mode: 'serial' });

  /** Upper case, unique per run: descriptions embed it, the rule keyword is its lower-case form. */
  let token: string;
  let keyword: string;

  // playwright requires an object pattern for the fixtures argument, even when none is used
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    token =
      `M${Date.now().toString(36)}${testInfo.testId.replace(/\W/g, '').slice(0, 4)}`.toUpperCase();
    keyword = `e2e mrule ${token.toLowerCase()}`;
  });

  test('import review: a rule fills an unlinked store, a link beats it, an unrelated row stays empty, and a row can be changed', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const account = await createTestAccount(page, 'E2E MRule Import');
    const chain = await createTestMerchant(page, 'E2E Kroger');
    const other = await createTestMerchant(page, 'E2E Other Shop');
    const linkedMerchant = await createTestMerchant(page, 'E2E Kroger Linked');

    const linked = `E2E MRULE ${token} #1`;
    const unlinked = `E2E MRULE ${token} #340`;
    const unrelated = `E2E UNRELATED ${token}`;
    await createTestDescriptionLink(page, linkedMerchant.id, linked);
    await createTestMerchantRule(page, chain.id, keyword, 5);
    await page.reload();

    await page
      .getByRole('button', { name: /Import CSV/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Import CSV statements' });
    await expect(dialog).toBeVisible();

    const fileName = 'standard-2026-02.csv';
    await dialog.locator('input[type="file"]').setInputFiles(
      statement(fileName, [
        [linked, '-10.00', '2026-02-03T00:00:00Z'],
        [unlinked, '-11.00', '2026-02-04T00:00:00Z'],
        [unrelated, '-12.00', '2026-02-05T00:00:00Z'],
      ]),
    );
    // the dialog only assigns an account by itself when exactly one account uses the Standard bank
    const fileRow = dialog.getByTestId('file-row').filter({ hasText: fileName });
    if (await fileRow.getByTestId('needs-account').isVisible()) {
      await fileRow.getByRole('combobox', { name: `Account for ${fileName}` }).click();
      await page.getByRole('option', { name: account.name, exact: true }).click();
    }
    await expect(fileRow.getByTestId('needs-account')).toBeHidden();
    await dialog.getByTestId('preview').click();
    await expect(dialog.getByTestId('step-heading')).toHaveText('Review & edit transactions');

    const reviewRow = (description: string) =>
      dialog.getByTestId('review-row').filter({ hasText: description });
    const merchantOf = (description: string) =>
      reviewRow(description).getByTestId('row-merchant').getByRole('combobox');

    await test.step('The unlinked store is pre-filled with the rule merchant', async () => {
      await expect(reviewRow(unlinked)).toHaveCount(1);
      await expect(merchantOf(unlinked)).toContainText(chain.name);
    });
    await test.step('The linked description keeps its linked merchant, not the rule merchant', async () => {
      await expect(merchantOf(linked)).toContainText(linkedMerchant.name);
      await expect(merchantOf(linked)).not.toContainText(chain.name);
    });
    await test.step('The unrelated description has no merchant', async () => {
      await expect(merchantOf(unrelated)).toContainText('No merchant');
    });

    await test.step('Changing the pre-filled merchant of one row affects only that row', async () => {
      await merchantOf(unlinked).click();
      await page.locator('.p-select-filter').fill(other.name);
      await page.getByRole('option', { name: other.name, exact: true }).click();
      await expect(merchantOf(unlinked)).toContainText(other.name);
      await expect(reviewRow(unlinked).getByTestId('row-status')).toContainText('Edited');
      await expect(reviewRow(linked).getByTestId('row-status')).not.toContainText('Edited');
      await expect(reviewRow(unrelated).getByTestId('row-status')).not.toContainText('Edited');
      await expect(merchantOf(linked)).toContainText(linkedMerchant.name);
      await expect(merchantOf(unrelated)).toContainText('No merchant');
    });

    await test.step('Cancel: nothing is imported, and the rule created no link', async () => {
      await dialog.getByTestId('cancel').click();
      await page
        .getByRole('alertdialog', { name: 'Discard import?' })
        .getByRole('button', { name: 'Discard' })
        .click();
      await expect(dialog).toBeHidden();
      const links = await page.request.get(`${API_URL}/merchants/${chain.id}/description-links`, {
        headers: { Authorization: `Bearer ${await getAuthToken(page)}` },
      });
      expect(links.ok()).toBeTruthy();
      expect(((await links.json()) as unknown[]).length).toBe(0);
    });
  });

  test('Settings: the live match list shows a verdict per row and a saved rule appears in the list', async ({
    page,
  }) => {
    await page.goto('/settings?section=merchant-rules');
    const account = await createTestAccount(page, 'E2E MRule Settings');
    const target = await createTestMerchant(page, 'E2E Kroger Target');
    const held = await createTestMerchant(page, 'E2E Kroger Held');
    const linkedMerchant = await createTestMerchant(page, 'E2E Kroger Link');

    const plain = `E2E MRULE ${token} STORE #11`;
    const linked = `E2E MRULE ${token} STORE #33`;
    await createTestTransactionExact(page, account.id, plain, {
      amount: 4.5,
      transactionDate: '2026-01-10T00:00:00Z',
    });
    await createTestTransactionExact(page, account.id, linked, {
      amount: 6.5,
      transactionDate: '2026-01-12T00:00:00Z',
    });
    await createTestDescriptionLink(page, linkedMerchant.id, linked);
    // createTestTransaction suffixes a timestamp to the description, so it is matched by its prefix
    await createTestTransaction(page, account.id, undefined, `E2E MRULE ${token} STORE #22`, {
      amount: 5.5,
      transactionDate: '2026-01-11T00:00:00Z',
      merchantId: held.id,
    });
    await page.reload();

    try {
      await page.getByRole('button', { name: 'Add rule' }).first().click();
      const panel = page.getByRole('complementary', { name: 'Add rule' });
      await panel.locator('#rule-keywords').fill(keyword);
      await panel.getByRole('combobox', { name: 'Merchant' }).click();
      await page.getByRole('option', { name: target.name, exact: true }).click();

      await test.step('The live match list shows one verdict per seeded row', async () => {
        const summary = page.getByTestId('match-summary');
        await expect(summary).toContainText('3 matches');
        await expect(summary).toContainText('1 will be assigned');
        await expect(page.locator('app-rule-match-list [data-match-row]')).toHaveCount(3);
        await expect(matchRow(page, '#11')).toContainText(`Will be assigned to ${target.name}`);
        await expect(matchRow(page, '#22')).toContainText(
          'Already has a merchant, the rule leaves it alone',
        );
        await expect(matchRow(page, '#33')).toContainText(
          'Linked to a merchant by an exact description link, the rule leaves it alone',
        );
      });

      await test.step('Typing alone saves nothing', async () => {
        const rules = await page.request.get(`${API_URL}/merchant-rules`, {
          headers: { Authorization: `Bearer ${await getAuthToken(page)}` },
        });
        expect(
          ((await rules.json()) as { keywords: string[] }[]).some((r) =>
            r.keywords.includes(keyword),
          ),
        ).toBe(false);
      });

      await test.step('Add rule saves it and the list shows it with its merchant', async () => {
        await panel.getByRole('button', { name: 'Add rule' }).click();
        try {
          await expect(page.getByText('Rule added')).toBeVisible();
        } finally {
          await trackMerchantRuleByKeyword(page, keyword);
        }
        await page.getByLabel('Search rules').fill(keyword);
        const row = page.locator('[data-rule-row]', { hasText: keyword });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(target.name);
        await expect(row).toContainText('Priority 0');
      });

      await test.step('The saved rule only stored: the matching rows still have no new merchant', async () => {
        const merchants = await merchantsByDescription(page, account.id);
        expect(merchants.get(plain)).toBeNull();
        expect(merchants.get(linked)).toBeNull();
      });
    } finally {
      await trackMerchantRuleByKeyword(page, keyword);
    }
  });

  test('Apply: only merchant-less matching rows get the merchant, and a second apply finds nothing', async ({
    page,
  }) => {
    await page.goto('/settings?section=merchant-rules');
    const account = await createTestAccount(page, 'E2E MRule Apply');
    const target = await createTestMerchant(page, 'E2E Kroger Apply');
    const held = await createTestMerchant(page, 'E2E Kroger Held');
    const linkedMerchant = await createTestMerchant(page, 'E2E Kroger Link');

    const first = `E2E MRULE ${token} APPLY #1`;
    const second = `E2E MRULE ${token} APPLY #2`;
    const linked = `E2E MRULE ${token} APPLY #3`;
    for (const [description, day] of [
      [first, '10'],
      [second, '11'],
      [linked, '12'],
    ]) {
      await createTestTransactionExact(page, account.id, description, {
        amount: 7.5,
        transactionDate: `2026-01-${day}T00:00:00Z`,
      });
    }
    await createTestDescriptionLink(page, linkedMerchant.id, linked);
    const hasMerchant = await createTestTransaction(
      page,
      account.id,
      undefined,
      `E2E MRULE ${token} APPLY #4`,
      { amount: 8.5, transactionDate: '2026-01-13T00:00:00Z', merchantId: held.id },
    );
    await createTestMerchantRule(page, target.id, keyword, 5);

    // Apply works on every merchant-less transaction of the user, not only this test's. If an
    // existing rule would change other rows, applying would edit the owner's real data: skip instead.
    const previewResponse = await page.request.get(`${API_URL}/merchant-rules/preview`, {
      headers: { Authorization: `Bearer ${await getAuthToken(page)}` },
    });
    expect(previewResponse.ok()).toBeTruthy();
    const foreign = ((await previewResponse.json()) as { description: string }[]).filter(
      (item) => !item.description.includes(token),
    );
    test.skip(
      foreign.length > 0,
      `Apply would also change ${foreign.length} transactions that are not this test's`,
    );

    await page.reload();

    await test.step('Apply rules previews exactly the two merchant-less matching rows', async () => {
      await page.getByRole('button', { name: 'Apply rules' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Apply Merchant Rules' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('columnheader', { name: 'Decided by' })).toBeVisible();
      await expect(dialog.getByText('2 Transactions Identified')).toBeVisible();
      const rows = dialog.getByRole('row').filter({ hasText: token });
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: first })).toContainText(target.name);
      await expect(rows.filter({ hasText: second })).toContainText(
        `a rule with keyword "${keyword}" (priority 5)`,
      );
      await expect(dialog.getByRole('row').filter({ hasText: linked })).toHaveCount(0);

      await dialog.getByRole('button', { name: /^Apply \d+ changes?$/ }).click();
      await expect(page.getByText('2 transactions got a merchant.')).toBeVisible();
      await expect(dialog).toBeHidden();
    });

    await test.step('Only the merchant-less matching rows changed', async () => {
      const merchants = await merchantsByDescription(page, account.id);
      expect(merchants.get(first)).toBe(target.id);
      expect(merchants.get(second)).toBe(target.id);
      expect(merchants.get(linked)).toBeNull();
      expect(merchants.get(hasMerchant.description)).toBe(held.id);
    });

    await test.step('A second apply finds nothing to change', async () => {
      await page.getByRole('button', { name: 'Apply rules' }).first().click();
      await expect(
        page.getByText('No transactions without a merchant match your current rules.'),
      ).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Apply Merchant Rules' })).toBeHidden();
    });
  });
});
