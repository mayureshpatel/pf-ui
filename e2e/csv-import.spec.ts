import { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { createTestAccount, createTestCategory } from './helpers/api';

/** A Standard-format CSV statement built in memory, for `setInputFiles`. */
interface StatementFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

function statement(
  name: string,
  rows: [description: string, amount: string, date: string][],
): StatementFile {
  const lines: string[] = ['description,amount,date', ...rows.map((row) => row.join(','))];
  return { name, mimeType: 'text/csv', buffer: Buffer.from(`${lines.join('\n')}\n`) };
}

/**
 * This test's statement files. Every description carries a token unique to the test run, so
 * ledger searches never match rows another test (or an earlier run on the shared dev user) left.
 */
function statementsFor(token: string) {
  const coffee = `E2E Import Coffee ${token}`;
  const groceries = `E2E Import Groceries ${token}`;
  return {
    coffee,
    groceries,
    // two rows with the same description, different days
    jan: statement('standard-2026-01.csv', [
      [coffee, '-4.50', '2026-01-05T00:00:00Z'],
      [coffee, '-4.50', '2026-01-12T00:00:00Z'],
    ]),
    feb: statement('standard-2026-02.csv', [[groceries, '-31.20', '2026-02-03T00:00:00Z']]),
    marchHeaderOnly: statement('standard-2026-03.csv', []),
    // not bank-YYYY-MM.csv
    misnamed: statement('statement.csv', [
      [`E2E Import Statement ${token}`, '-12.00', '2026-04-02T00:00:00Z'],
    ]),
  };
}

let files: ReturnType<typeof statementsFor>;

async function newAccount(page: Page): Promise<{ id: number; name: string }> {
  return createTestAccount(page, 'E2E CSV Import');
}

/** A parent category and a subcategory under it; only a subcategory can go on a transaction. */
async function newSubcategory(
  page: Page,
): Promise<{ id: number; name: string; optionName: string }> {
  const parent = await createTestCategory(page, 'E2E Import Parent');
  const child = await createTestCategory(page, 'E2E Import Category', parent.id);
  // the dropdown lists a subcategory as "<Parent> / <Child>" (the bare parent is a separate, non-selectable entry)
  return { ...child, optionName: `${parent.name} / ${child.name}` };
}

async function openImportDialog(page: Page): Promise<Locator> {
  await page
    .getByRole('button', { name: /Import CSV/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV statements' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Picks `accountName` for a file unless the dialog already assigned one. A file named
 * `standard-YYYY-MM.csv` is only assigned automatically when exactly ONE account uses the Standard
 * bank; the shared dev user usually has several, so the file is then flagged "more than one account
 * uses this bank" and has to be assigned by hand. Either way the end state is the same.
 */
async function ensureAccount(
  page: Page,
  dialog: Locator,
  fileName: string,
  accountName: string,
): Promise<void> {
  const row = dialog.getByTestId('file-row').filter({ hasText: fileName });
  if (await row.getByTestId('needs-account').isVisible()) {
    await row.getByRole('combobox', { name: `Account for ${fileName}` }).click();
    await page.getByRole('option', { name: accountName, exact: true }).click();
  }
  await expect(row.getByTestId('needs-account')).toBeHidden();
}

/** Ledger rows for a description, over all time (the page opens on This month; the fixtures are older). */
async function ledgerRows(page: Page, description: string): Promise<Locator> {
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await page.getByRole('searchbox').fill(description);
  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible();
  return page.getByRole('row').filter({ hasText: description });
}

test.describe('CSV import dialog -> ledger', () => {
  // the tests share the module-level `files` state and the one dev user; run them in order
  test.describe.configure({ mode: 'serial' });

  // playwright requires an object pattern for the fixtures argument, even when none is used
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    files = statementsFor(`${testInfo.testId}-${Date.now()}`);
  });

  test('two statement files import together and a Review edit changes one row only', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const account = await newAccount(page);
    const category = await newSubcategory(page);
    await page.reload();

    const dialog = await openImportDialog(page);

    await test.step('Files: choose two bank-YYYY-MM.csv files; bank and month come from the name', async () => {
      await dialog.locator('input[type="file"]').setInputFiles([files.jan, files.feb]);
      await expect(dialog.getByTestId('summary')).toContainText('2 files, 2026-01 to 2026-02');
      for (const name of ['standard-2026-01.csv', 'standard-2026-02.csv']) {
        await ensureAccount(page, dialog, name, account.name);
        await expect(
          dialog.getByRole('combobox', { name: `Bank format for ${name}` }),
        ).toContainText('Standard CSV');
      }
      await dialog.getByTestId('preview').click();
    });

    await test.step('Review: edit the category of ONE of the two same-description rows', async () => {
      await expect(dialog.getByTestId('step-heading')).toHaveText('Review & edit transactions');
      await expect(dialog.getByTestId('review-summary')).toContainText('3 transactions in 2 files');
      await expect(dialog.getByTestId('review-summary')).toContainText('3 will import');

      const coffee = dialog.getByTestId('review-row').filter({ hasText: files.coffee });
      await expect(coffee).toHaveCount(2);
      await coffee.first().getByTestId('row-category').getByRole('combobox').click();
      await page.getByRole('option', { name: category.optionName, exact: true }).click();

      // row-local: the first row changed, its twin kept what it had
      await expect(coffee.first().getByTestId('row-status')).toHaveText('Edited');
      await expect(coffee.last().getByTestId('row-status')).not.toHaveText('Edited');
      await expect(coffee.last().getByTestId('row-category')).not.toContainText(category.name);
    });

    await test.step('Result: both files imported, no transfer dialog until asked for', async () => {
      await dialog.getByTestId('import').click();
      await expect(dialog.getByTestId('step-heading')).toHaveText('Import result');
      await expect(dialog.getByTestId('result-summary')).toContainText('2 of 2 files imported');
      const outcomes = dialog.getByTestId('file-outcome');
      await expect(outcomes).toHaveCount(2);
      await expect(outcomes.filter({ hasText: 'standard-2026-01.csv' })).toContainText(
        '2 transactions saved',
      );
      await expect(outcomes.filter({ hasText: 'standard-2026-02.csv' })).toContainText(
        '1 transaction saved',
      );

      // The offer only exists when the user has possible transfers (count comes from the existing
      // suggestions endpoint, for the whole user -- this import's rows are not guaranteed to add any).
      // Either way the transfer dialog must not have opened by itself.
      const transferDialog = page.getByRole('dialog', { name: 'Internal Transfer Reconciliation' });
      await expect(transferDialog).toBeHidden();
      const reviewTransfers = dialog.getByRole('button', {
        name: /^Review \d+ possible transfers?$/,
      });
      if (await reviewTransfers.isVisible()) {
        await reviewTransfers.click();
        await expect(transferDialog).toBeVisible();
        await transferDialog.getByRole('button', { name: 'Close' }).click();
      } else {
        await expect(reviewTransfers).toHaveCount(0);
        await dialog.getByTestId('close').click();
      }
      await expect(dialog).toBeHidden();
    });

    await test.step('Ledger: the edited category is on exactly one coffee row', async () => {
      const coffee = await ledgerRows(page, files.coffee);
      await expect(coffee).toHaveCount(2);
      await expect(coffee.filter({ hasText: category.name })).toHaveCount(1);
      await expect(coffee.filter({ hasNotText: category.name })).toHaveCount(1);
    });
  });

  test('a misnamed file is flagged and Preview stays disabled until it has an account', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const account = await newAccount(page);
    await page.reload();

    const dialog = await openImportDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles(files.misnamed);

    const row = dialog.getByTestId('file-row').filter({ hasText: 'statement.csv' });
    await expect(row.getByTestId('needs-account')).toContainText(
      'name not recognised, expected bank-YYYY-MM.csv',
    );
    await expect(dialog.getByTestId('summary')).toContainText('1 needs an account');
    await expect(dialog.getByTestId('preview')).toBeDisabled();

    // choosing the account also fills the bank format from the account's own bank
    await row.getByRole('combobox', { name: 'Account for statement.csv' }).click();
    await page.getByRole('option', { name: account.name, exact: true }).click();
    await expect(row.getByTestId('needs-account')).toBeHidden();
    await expect(
      row.getByRole('combobox', { name: 'Bank format for statement.csv' }),
    ).toContainText('Standard CSV');
    await expect(dialog.getByTestId('preview')).toBeEnabled();
  });

  test('importing the same file again shows it as already imported and adds nothing', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const account = await newAccount(page);
    await page.reload();

    const importJan = async (): Promise<Locator> => {
      const dialog = await openImportDialog(page);
      await dialog.locator('input[type="file"]').setInputFiles(files.jan);
      await ensureAccount(page, dialog, 'standard-2026-01.csv', account.name);
      await dialog.getByTestId('preview').click();
      await expect(dialog.getByTestId('step-heading')).toHaveText('Review & edit transactions');
      return dialog;
    };
    const finish = async (dialog: Locator): Promise<void> => {
      await dialog.getByTestId('import').click();
      await expect(dialog.getByTestId('step-heading')).toHaveText('Import result');
    };
    const closeResult = async (dialog: Locator): Promise<void> => {
      // a possible-transfers offer is optional and unrelated here; closing the dialog is enough
      await dialog.getByTestId('close').click();
      await expect(dialog).toBeHidden();
    };

    await test.step('first import saves both rows', async () => {
      const dialog = await importJan();
      await finish(dialog);
      await expect(dialog.getByTestId('result-summary')).toContainText('1 of 1 file imported');
      await closeResult(dialog);
      await expect(await ledgerRows(page, files.coffee)).toHaveCount(2);
    });

    await test.step('second import: Review flags the file, Result skips it', async () => {
      const dialog = await importJan();
      await expect(dialog.getByTestId('file-header')).toContainText('Already imported');
      await expect(dialog.getByTestId('review-summary')).toContainText('0 will import');
      const rows = dialog.getByTestId('review-row');
      await expect(rows).toHaveCount(2);
      for (const status of await rows.getByTestId('row-status').all()) {
        await expect(status).toHaveText('Will be skipped: file already imported');
      }

      await finish(dialog);
      await expect(dialog.getByTestId('result-summary')).toContainText('0 of 1 file imported');
      await expect(dialog.getByTestId('file-outcome')).toContainText('Skipped: already imported');
      await closeResult(dialog);
    });

    await test.step('Ledger: still exactly the two rows from the first import', async () => {
      await page.reload();
      await expect(await ledgerRows(page, files.coffee)).toHaveCount(2);
    });
  });

  test('a header-only file is reported as having no transactions and does not stop the other file', async ({
    page,
  }) => {
    await page.goto('/transactions');
    const account = await newAccount(page);
    await page.reload();

    const dialog = await openImportDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles([files.marchHeaderOnly, files.feb]);
    for (const name of ['standard-2026-02.csv', 'standard-2026-03.csv']) {
      await ensureAccount(page, dialog, name, account.name);
    }
    await dialog.getByTestId('preview').click();

    await expect(dialog.getByTestId('step-heading')).toHaveText('Review & edit transactions');
    await expect(dialog.getByTestId('empty-file')).toHaveText('No transactions in this file');
    await expect(dialog.getByTestId('review-summary')).toContainText('1 transaction in 2 files');

    await dialog.getByTestId('import').click();
    await expect(dialog.getByTestId('step-heading')).toHaveText('Import result');
    await expect(dialog.getByTestId('result-summary')).toContainText('1 of 2 files imported');
    const outcomes = dialog.getByTestId('file-outcome');
    await expect(outcomes.filter({ hasText: 'standard-2026-02.csv' })).toContainText('Imported');
    await expect(outcomes.filter({ hasText: 'standard-2026-03.csv' })).toContainText(
      'Skipped: no transactions in file',
    );
    await dialog.getByTestId('close').click();
    await expect(dialog).toBeHidden();

    await expect(await ledgerRows(page, files.groceries)).toHaveCount(1);
  });
});
