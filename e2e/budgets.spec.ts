import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-333: setting a budget through the real UI (budget-form-dialog) and verifying actual
 * vs. budgeted spending renders correctly. Uses a brand-new registered user so the spent/remaining
 * amounts are exact -- the shared dev user has months of accumulated transactions that would make
 * asserting a specific total fragile. Budgets default to the current month/year, so the seeded
 * transaction is dated "today" (in UTC) rather than a fixed date.
 *
 * budget-form-dialog was migrated from p-dialog to DrawerComponent by PF-803 -- PrimeNG 21.1.3's
 * p-select silently failed to register a clicked option when hosted inside a p-dialog (no error,
 * no visible sign, just a permanently-disabled Save button). Interacting with it here as a drawer
 * (getByRole('complementary'), matching every other drawer-based form spec) rather than a dialog.
 */
test.describe('Budgets', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('set a budget and see actual spending tracked against it', async ({page}) => {
    await registerTestUser(page);

    // Budgeting allows either a parent or a subcategory, but transactions can only be assigned to
    // a subcategory -- budget and transact against the same subcategory to keep this simple and
    // sidestep whether/how a parent's budget rolls up its children's spending.
    const parentCategory = await createTestCategory(page, 'E2E Budget Parent');
    const category = await createTestCategory(page, 'E2E Budget Category', parentCategory.id);
    const account = await createTestAccount(page, 'E2E Budget Account');

    const now = new Date();
    const currentMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)).toISOString();
    await createTestTransaction(page, account.id, category.id, 'E2E Budget Expense', {
      amount: 120, type: 'EXPENSE', transactionDate: currentMonthDate
    });

    await page.goto('/budgets');

    // Set the budget through the real UI
    await page.getByRole('button', {name: 'Set Budget'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByText('Set Category Budget')).toBeVisible();

    await drawer.getByText('Select a category').click();
    await page.getByRole('option', {name: category.name}).click();
    await drawer.getByRole('spinbutton').fill('300');
    await drawer.getByRole('button', {name: 'Save Budget'}).click();

    await expect(page.getByText('Budget saved successfully')).toBeVisible();
    await expect(drawer).toBeHidden();

    // Monthly status reflects the real budgeted vs. actual spend
    const row = page.getByRole('row', {name: new RegExp(category.name)});
    await expect(row).toBeVisible();
    await expect(row.getByText('$300.00')).toBeVisible(); // budgeted
    await expect(row.getByText('$120.00')).toBeVisible(); // spent
    await expect(row.getByText('$180.00')).toBeVisible(); // remaining
    await expect(row.getByText('40%')).toBeVisible(); // percentage used

    const budgetedCard = page.locator('p-card').filter({hasText: 'Total Budgeted'});
    await expect(budgetedCard.getByText('$300.00')).toBeVisible();
    const spentCard = page.locator('p-card').filter({hasText: 'Total Spent'});
    await expect(spentCard.getByText('$120.00')).toBeVisible();
    // "Remaining" is also the monthly-status table's own column header -- .first() picks the
    // summary card, which renders before the table in DOM order.
    const remainingCard = page.locator('p-card').filter({hasText: 'Remaining'}).first();
    await expect(remainingCard.getByText('$180.00')).toBeVisible();
  });
});
