import {expect, test} from '@playwright/test';
import {createTestCategory, createTestTransaction, findAccountByName} from './helpers/api';

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

    // Create
    await page.getByRole('button', {name: 'New Account'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'Create Account'})).toBeVisible();

    await drawer.locator('#name').fill(accountName);
    await drawer.getByText('Select account type').click();
    await page.getByRole('option', {name: 'Checking', exact: true}).click();
    await drawer.getByRole('spinbutton').fill('500');
    await drawer.getByRole('button', {name: 'Create'}).click();

    await expect(page.getByText('Account created successfully')).toBeVisible();
    await expect(drawer).toBeHidden();

    const row = page.getByRole('row', {name: new RegExp(accountName)});
    await expect(row).toBeVisible();
    await expect(row.getByText('$500.00')).toBeVisible();
    await expect(row.getByText('Checking')).toBeVisible();

    // Edit
    await row.getByRole('button', {name: 'Edit Account'}).click();
    const editDrawer = page.getByRole('complementary');
    await expect(editDrawer.getByRole('heading', {name: 'Edit Account'})).toBeVisible();
    await expect(editDrawer.locator('#name')).toHaveValue(accountName);

    await editDrawer.locator('#name').fill(renamedAccountName);
    await editDrawer.getByRole('button', {name: 'Update'}).click();

    await expect(page.getByText('Account updated successfully')).toBeVisible();
    const renamedRow = page.getByRole('row', {name: new RegExp(renamedAccountName)});
    await expect(renamedRow).toBeVisible();

    // Delete, with confirmation
    await renamedRow.getByRole('button', {name: 'Delete Account'}).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog.getByText('This will permanently delete the account. This action cannot be undone.')).toBeVisible();
    await confirmDialog.getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Account deleted successfully')).toBeVisible();
    await expect(page.getByRole('row', {name: new RegExp(renamedAccountName)})).not.toBeVisible();
  });

  test('refuses to delete an account that has existing transactions', async ({page}) => {
    const accountName = `E2E CRUD Guarded Account ${Date.now()}`;

    await page.goto('/accounts');

    await page.getByRole('button', {name: 'New Account'}).click();
    const drawer = page.getByRole('complementary');
    await drawer.locator('#name').fill(accountName);
    await drawer.getByText('Select account type').click();
    await page.getByRole('option', {name: 'Checking', exact: true}).click();
    await drawer.getByRole('spinbutton').fill('100');
    await drawer.getByRole('button', {name: 'Create'}).click();
    await expect(page.getByText('Account created successfully')).toBeVisible();

    const row = page.getByRole('row', {name: new RegExp(accountName)});
    await expect(row).toBeVisible();

    // The account's real id isn't exposed in the DOM -- look it up via the API instead of parsing
    // it out of the row.
    const account = await findAccountByName(page, accountName);
    const parentCategory = await createTestCategory(page, 'E2E CRUD Guard Parent');
    const category = await createTestCategory(page, 'E2E CRUD Guard Category', parentCategory.id);
    await createTestTransaction(page, account.id, category.id, 'E2E CRUD Guard Txn');

    await page.reload();
    await row.getByRole('button', {name: 'Delete Account'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText(/Cannot delete account with existing transactions/)).toBeVisible();
    await expect(page.getByRole('row', {name: new RegExp(accountName)})).toBeVisible();
  });
});
