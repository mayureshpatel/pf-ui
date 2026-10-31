import {expect, test} from './fixtures/test';
import {createTestCategory, createTestTransaction, findAccountByName} from './helpers/api';
import {trackByName} from './helpers/cleanup';

/**
 * Covers PF-338: account CRUD through the real UI (create, edit, delete -- including the app's
 * real "cannot delete an account with existing transactions" rule), distinct from
 * account-reconciliation.spec.ts's reconciliation flow.
 */
test.describe('Accounts Core CRUD', () => {
  test('create, edit, and delete an account with no transactions', async ({page}) => {
    const accountName = `E2E CRUD Account ${Date.now()}`;
    const renamedAccountName = `${accountName} Renamed`;

    await page.goto('/accounts');
    // With no accounts at all the panel opens on the add form instead of the overview.
    await expect(page.getByRole('complementary', {name: /^(Overview|Add account)$/})).toBeVisible();

    // Create
    await page.getByRole('button', {name: 'Add account'}).first().click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'Add account'})).toBeVisible();

    await drawer.locator('#name').fill(accountName);
    await drawer.getByText('Select account type').click();
    await page.getByRole('option', {name: 'Checking', exact: true}).click();
    await drawer.getByRole('spinbutton').fill('500');
    await drawer.getByRole('button', {name: 'Add account'}).click();

    await expect(page.getByText('Account created successfully')).toBeVisible();
    await trackByName(page, 'account', accountName);
    // The panel stays open on the new account's summary.
    await expect(drawer.getByRole('heading', {name: accountName})).toBeVisible();
    await expect(drawer.getByTestId('balance')).toContainText('$500.00');

    const row = page.getByTestId('open-account').filter({hasText: accountName});
    await expect(row).toBeVisible();
    await expect(row).toContainText('$500.00');

    // Edit
    await drawer.getByRole('button', {name: 'Edit details'}).click();
    await expect(drawer.getByRole('heading', {name: `Edit ${accountName}`})).toBeVisible();
    await expect(drawer.locator('#name')).toHaveValue(accountName);

    await drawer.locator('#name').fill(renamedAccountName);
    await drawer.getByRole('button', {name: 'Save changes'}).click();

    await expect(page.getByText('Account updated successfully')).toBeVisible();
    const renamedRow = page.getByTestId('open-account').filter({hasText: renamedAccountName});
    await expect(renamedRow).toBeVisible();

    // Delete, with confirmation
    await drawer.getByRole('button', {name: 'Delete account'}).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog.getByText('This permanently deletes the account and cannot be undone.')).toBeVisible();
    await confirmDialog.getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Account deleted successfully')).toBeVisible();
    await expect(page.getByTestId('open-account').filter({hasText: renamedAccountName})).toHaveCount(0);
    // Deleting the shown account returns the panel to the overview.
    // With no accounts at all the panel opens on the add form instead of the overview.
    await expect(page.getByRole('complementary', {name: /^(Overview|Add account)$/})).toBeVisible();
  });

  test('refuses to delete an account that has existing transactions', async ({page}) => {
    const accountName = `E2E CRUD Guarded Account ${Date.now()}`;

    await page.goto('/accounts');

    await page.getByRole('button', {name: 'Add account'}).first().click();
    const drawer = page.getByRole('complementary');
    await drawer.locator('#name').fill(accountName);
    await drawer.getByText('Select account type').click();
    await page.getByRole('option', {name: 'Checking', exact: true}).click();
    await drawer.getByRole('spinbutton').fill('100');
    await drawer.getByRole('button', {name: 'Add account'}).click();
    await expect(page.getByText('Account created successfully')).toBeVisible();
    await trackByName(page, 'account', accountName);

    const row = page.getByTestId('open-account').filter({hasText: accountName});
    await expect(row).toBeVisible();

    // The account's real id isn't exposed in the DOM -- look it up via the API instead of parsing
    // it out of the row.
    const account = await findAccountByName(page, accountName);
    const parentCategory = await createTestCategory(page, 'E2E CRUD Guard Parent');
    const category = await createTestCategory(page, 'E2E CRUD Guard Category', parentCategory.id);
    await createTestTransaction(page, account.id, category.id, 'E2E CRUD Guard Txn');

    await page.reload();
    await row.click();
    await page.getByRole('complementary').getByRole('button', {name: 'Delete account'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText(/Cannot delete account with existing transactions/)).toBeVisible();
    await expect(page.getByTestId('open-account').filter({hasText: accountName})).toBeVisible();
  });
});
