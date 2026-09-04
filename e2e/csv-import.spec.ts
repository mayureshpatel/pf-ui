import * as path from 'path';
import {expect, test} from '@playwright/test';
import {createTestAccount} from './helpers/api';

const FIXTURE = path.resolve(__dirname, 'fixtures/standard-transactions.csv');

/**
 * Covers ingestion through to the ledger. "Rollback -> verify reverts" from the original ticket
 * is excluded: there is no rollback/undo-import endpoint anywhere in the backend (confirmed by
 * grepping every controller) -- FileImportHistoryRepository.deleteById exists but nothing calls
 * it. Not something this suite can test because it doesn't exist yet.
 */
test.describe('CSV Ingestion -> ledger', () => {
  test('importing a Standard CSV file adds its transactions to the ledger', async ({page}) => {
    await page.goto('/transactions');
    const account = await createTestAccount(page, 'E2E CSV Import');

    await page.reload();
    await page.getByRole('button', {name: /Import CSV/}).first().click();

    // Scoped to the dialog itself -- once the ledger has data (from an earlier run of this same
    // spec), the underlying page also has its own <table>, and an unscoped locator can resolve
    // to that one instead of the dialog's.
    const dialog = page.getByRole('dialog', {name: 'Import Transaction Ledger'});
    await dialog.locator('input[type="file"]').setInputFiles(FIXTURE);

    const row = dialog.locator('table tbody tr').first();
    await row.getByText('Select...').first().click();
    await page.getByRole('option', {name: account.name, exact: true}).click();

    // Selecting the account auto-fills the bank format too, since this account was created with
    // bankName: 'STANDARD' -- CsvImportDialog.onAccountChange() copies the account's own bank
    // onto the row whenever one isn't already set. No second dropdown needed.
    await expect(row.getByText('Standard CSV')).toBeVisible();

    await dialog.getByRole('button', {name: 'Analyze Files'}).click();
    await expect(dialog.getByText('2 transactions from 1 file(s)')).toBeVisible();

    await dialog.getByRole('button', {name: 'Import Ledger'}).click();
    await expect(page.getByText('Batch complete: 1 files imported.')).toBeVisible();

    // A successful import always opens this dialog afterwards to offer matching new
    // transactions against existing ones as internal transfers, even when (as here) there's
    // nothing to match. It blocks the rest of the page until dismissed.
    await page.getByRole('dialog', {name: 'Internal Transfer Reconciliation'}).getByRole('button', {name: 'Close'}).click();

    await expect(page.getByRole('cell', {name: /E2E Test Grocery Purchase/}).first()).toBeVisible();
    await expect(page.getByRole('cell', {name: '-$42.17'}).first()).toBeVisible();
  });
});
