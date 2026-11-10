import {expect, test} from './fixtures/test';
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
    await page.getByRole('button', {name: 'Add transaction'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'New transaction'})).toBeVisible();

    await drawer.getByRole('spinbutton').fill('42.50');
    await drawer.getByText('Select the account...').click();
    await page.getByRole('option', {name: account.name, exact: true}).click();
    await drawer.getByText('Select a category...').click();
    await page.getByRole('option', {name: category.name, exact: true}).click();
    await drawer.locator('textarea#description').fill(description);
    await drawer.getByRole('button', {name: 'Post transaction'}).click();

    await expect(page.getByText('Transaction created')).toBeVisible();
    await expect(drawer).toBeHidden();

    const row = page.getByRole('row', {name: new RegExp(description)});
    await expect(row).toBeVisible();
    await expect(row.getByText('-$42.50')).toBeVisible();
    await expect(row.getByText(category.name)).toBeVisible();
    await expect(row.getByText(account.name)).toBeVisible();

    // Edit
    await row.getByTestId('open-transaction').click();
    const editDrawer = page.getByRole('complementary');
    await expect(editDrawer.getByRole('heading', {name: 'Edit transaction'})).toBeVisible();
    await expect(editDrawer.getByRole('spinbutton')).toHaveValue('$42.50');

    await editDrawer.getByRole('spinbutton').fill('99.99');
    await editDrawer.locator('textarea#description').fill(updatedDescription);
    await editDrawer.getByRole('button', {name: 'Save changes'}).click();

    await expect(page.getByText('Transaction updated')).toBeVisible();
    // the panel stays open on the saved row, so the next step can use it
    const updatedRow = page.getByRole('row', {name: new RegExp(updatedDescription)});
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByText('-$99.99')).toBeVisible();

    // Delete, with confirmation
    await editDrawer.getByRole('button', {name: 'Delete'}).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog.getByText('This will permanently remove this record. Continue?')).toBeVisible();
    await confirmDialog.getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Transaction deleted')).toBeVisible();
    await expect(page.getByRole('row', {name: new RegExp(updatedDescription)})).not.toBeVisible();
  });

  // PF-935: a date changed in the picker used to be sent as a long local date string, which the
  // server rejected with a 400, so only the pre-filled "today" could ever be saved.
  test('create a transaction dated in the past, and the ledger lists it under that day', async ({page}) => {
    // the ledger is filtered to that one day first, so the row can only show up if the saved date is right
    await page.goto('/transactions?startDate=2025-12-08&endDate=2025-12-08');
    const account = await createTestAccount(page, 'E2E Past Date Account');
    const parentCategory = await createTestCategory(page, 'E2E Past Date Parent');
    const category = await createTestCategory(page, 'E2E Past Date Category', parentCategory.id);
    const description = `E2E Past Date Txn ${Date.now()}`;

    await page.reload();

    await page.getByRole('button', {name: 'Add transaction'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'New transaction'})).toBeVisible();

    await drawer.getByRole('spinbutton').fill('17.25');
    await drawer.getByText('Select the account...').click();
    await page.getByRole('option', {name: account.name, exact: true}).click();
    await drawer.getByText('Select a category...').click();
    await page.getByRole('option', {name: category.name, exact: true}).click();
    await drawer.locator('textarea#description').fill(description);

    // change the date from the pre-filled today to a past day, by picking it in the calendar
    // (typing it with real key events works too; Playwright's fill() sends no key events, which
    // the date picker ignores, so it cannot be used here)
    const dateInput = drawer.locator('#date input');
    await dateInput.click();
    const now = new Date();
    const monthsBack = (now.getFullYear() - 2025) * 12 + (now.getMonth() - 11);
    for (let i = 0; i < monthsBack; i++) {
      await page.getByRole('button', {name: 'Previous Month'}).click();
    }
    await expect(page.locator('.p-datepicker-title')).toContainText(/December\s*2025/);
    await page.getByRole('gridcell', {name: '8', exact: true}).click();
    await drawer.locator('textarea#description').click();
    await expect(dateInput).toHaveValue('2025-12-08');

    await drawer.getByRole('button', {name: 'Post transaction'}).click();

    await expect(page.getByText('Transaction created')).toBeVisible();
    await expect(drawer).toBeHidden();

    await expect(page.getByTestId('day-heading').getByText('Monday, Dec 8, 2025')).toBeVisible();
    const row = page.getByRole('row', {name: new RegExp(description)});
    await expect(row).toBeVisible();
    await expect(row.getByText('-$17.25')).toBeVisible();
  });
});
