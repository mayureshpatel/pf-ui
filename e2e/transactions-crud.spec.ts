import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory} from './helpers/api';

/**
 * Covers PF-337: manual single-transaction CRUD through the real ledger UI (create, edit,
 * delete), distinct from csv-import.spec.ts's bulk-import flow. This is the app's most-used
 * feature and previously had zero coverage of its own core lifecycle.
 */
test.describe('Transactions Core CRUD', () => {
  test('create, edit, and delete a transaction from the ledger', async ({page}) => {
    await page.goto('/transactions');
    const account = await createTestAccount(page, 'E2E CRUD Account');
    // transactions can only carry a subcategory, not a top-level parent (confirmed via the
    // backend's own validation message during PF-308's e2e work)
    const parentCategory = await createTestCategory(page, 'E2E CRUD Parent');
    const category = await createTestCategory(page, 'E2E CRUD Category', parentCategory.id);
    const description = `E2E CRUD Txn ${Date.now()}`;
    const updatedDescription = `${description} Updated`;

    await page.reload();

    // Create
    await page.getByRole('button', {name: 'Add Transaction'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'New Transaction'})).toBeVisible();

    await drawer.getByRole('spinbutton').fill('42.50');
    await drawer.getByText('Select the account...').click();
    await page.getByRole('option', {name: account.name, exact: true}).click();
    await drawer.getByText('Select a category...').click();
    await page.getByRole('option', {name: category.name, exact: true}).click();
    await drawer.locator('textarea#description').fill(description);
    await drawer.getByRole('button', {name: 'Post Transaction'}).click();

    await expect(page.getByText('Transaction created')).toBeVisible();
    await expect(drawer).toBeHidden();

    const row = page.getByRole('row', {name: new RegExp(description)});
    await expect(row).toBeVisible();
    await expect(row.getByText('-$42.50')).toBeVisible();
    await expect(row.getByText(category.name)).toBeVisible();
    await expect(row.getByText(account.name)).toBeVisible();

    // Edit
    await row.locator('button:has(.pi-pencil)').click();
    const editDrawer = page.getByRole('complementary');
    await expect(editDrawer.getByRole('heading', {name: 'Edit Transaction'})).toBeVisible();
    await expect(editDrawer.getByRole('spinbutton')).toHaveValue('$42.50');

    await editDrawer.getByRole('spinbutton').fill('99.99');
    await editDrawer.locator('textarea#description').fill(updatedDescription);
    await editDrawer.getByRole('button', {name: 'Update Record'}).click();

    await expect(page.getByText('Transaction updated')).toBeVisible();
    const updatedRow = page.getByRole('row', {name: new RegExp(updatedDescription)});
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByText('-$99.99')).toBeVisible();

    // Delete, with confirmation
    await updatedRow.locator('button:has(.pi-trash)').click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog.getByText('This will permanently remove this record. Continue?')).toBeVisible();
    await confirmDialog.getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Transaction deleted')).toBeVisible();
    await expect(page.getByRole('row', {name: new RegExp(updatedDescription)})).not.toBeVisible();
  });
});
