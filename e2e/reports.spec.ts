import {expect, test} from '@playwright/test';
import {
  createTestAccount,
  createTestAccountsBulk,
  createTestCategory,
  createTestMerchant,
  createTestTransaction,
  createTestTransactionsBulk,
  registerTestUser
} from './helpers/api';

/**
 * Covers PF-886: the Reports explorer through the real UI -- group spending by category, drill to
 * a subcategory, a merchant and the transactions behind the number, open them on the Transactions
 * page, compare with an earlier period, share the state as a link, the tag double-count note, and
 * the Net worth view. Uses brand-new registered users so every total is exact; read-only after
 * seeding. Also keeps PF-823's guarantee that nothing is capped at 1,000 rows.
 */
test.describe('Reports explorer', () => {
  test.use({storageState: {cookies: [], origins: []}});

  const row = (page: import('@playwright/test').Page, name: string | RegExp) =>
    page.locator('[data-row]', {hasText: name});

  test('drill from a category to its transactions, compare, share, tags and net worth', async ({page}) => {
    await registerTestUser(page);
    // createTestAccount seeds a $1,000 starting balance (the Net worth assertion depends on it)
    const account = await createTestAccount(page, 'E2E Reports Account');
    const parent = await createTestCategory(page, 'E2E Reports Parent');
    const category = await createTestCategory(page, 'E2E Reports Category', parent.id);
    const merchant = await createTestMerchant(page, 'E2E Reports Merchant');
    const today = new Date().toISOString();
    await createTestTransaction(page, account.id, category.id, 'E2E Reports Purchase', {
      amount: 100, type: 'EXPENSE', transactionDate: today, merchantId: merchant.id
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Reports Purchase', {
      amount: 50, type: 'EXPENSE', transactionDate: today, merchantId: merchant.id
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Reports Income', {
      amount: 500, type: 'INCOME', transactionDate: today
    });

    await page.goto('/reports');

    // 1. spending by category, this year: the parent holds both expenses
    await expect(page.getByRole('heading', {name: 'Spending by category'})).toBeVisible();
    await expect(row(page, parent.name)).toContainText('$150.00');

    // 2. drill into it: subcategories, with a breadcrumb and a chip
    await row(page, parent.name).getByRole('button', {name: new RegExp(parent.name)}).first().click();
    await expect(page.getByRole('heading', {name: `Spending by subcategory: ${parent.name}`})).toBeVisible();
    await expect(page.getByRole('navigation', {name: 'Drill path'})).toContainText(parent.name);
    await expect(row(page, category.name)).toContainText('$150.00');

    // 3. drill into the subcategory: merchants; then into the merchant: the transactions
    await row(page, category.name).getByRole('button', {name: new RegExp(category.name)}).first().click();
    await expect(page.getByRole('heading', {name: /Spending by merchant/})).toBeVisible();
    const merchantRow = row(page, merchant.name);
    await expect(merchantRow).toContainText('$150.00');
    await merchantRow.getByRole('button', {name: merchant.name}).first().click();
    await expect(page.getByRole('heading', {name: /^Transactions:/})).toBeVisible();
    const transactions = page.locator('app-transaction-list tbody tr');
    await expect(transactions).toHaveCount(2);
    await expect(transactions.filter({hasText: '$100.00'})).toHaveCount(1);
    await expect(transactions.filter({hasText: '$50.00'})).toHaveCount(1);

    // 4. the state is the URL: a fresh load of it shows the same place
    const link = page.url();
    expect(link).toContain('drill=');
    await page.goto(link);
    await expect(page.getByRole('heading', {name: /^Transactions:/})).toBeVisible();
    await expect(page.locator('app-transaction-list tbody tr')).toHaveCount(2);

    // 5. open the same transactions on the Transactions page with the filters carried over
    await page.getByRole('button', {name: 'Open in Transactions'}).click();
    await expect(page).toHaveURL(/\/transactions\?.*categoryName=/);
    await expect(page).toHaveURL(/merchant=/);
    await page.goBack();

    // 6. step back through the breadcrumb to the start
    await page.getByRole('navigation', {name: 'Drill path'}).getByRole('button', {name: 'All spending'}).click();
    await expect(page.getByRole('heading', {name: 'Spending by category'})).toBeVisible();

    // 7. compare with the previous period: the parent had nothing before, so it reads as new
    await page.locator('#explore-compare').click();
    await page.getByRole('option', {name: 'Previous period'}).click();
    await expect(page.getByText(/compared with previous period/)).toBeVisible();
    await expect(row(page, parent.name)).toContainText('new');

    // 8. a tag grouping says a transaction with two tags counts under both
    await page.locator('#explore-group-by').click();
    await page.getByRole('option', {name: 'Tag', exact: true}).click();
    await expect(page.getByText(/appears under each of its tags/)).toBeVisible();

    // 9. Net worth view (PF-305): $1,000 starting balance + 500 income - 100 - 50 = $1,350
    await page.getByRole('button', {name: 'Net worth'}).click();
    await expect(page.getByText('Net Worth Over Time')).toBeVisible();
    await expect(page.getByText('$1,350.00').first()).toBeVisible();
  });

  test('totals cover every transaction, not just the newest 1,000', async ({page}) => {
    test.setTimeout(300_000);

    await registerTestUser(page);
    // spread across several accounts so the concurrent writes don't contend for one row
    const accounts = await createTestAccountsBulk(page, 'PF-886 Cap Test Account', 20);
    const parent = await createTestCategory(page, 'PF-886 Cap Test Parent');
    const category = await createTestCategory(page, 'PF-886 Cap Test Category', parent.id);
    const merchant = await createTestMerchant(page, 'PF-886 Cap Test Vendor');
    const count = 1200;
    await createTestTransactionsBulk(
      page, accounts.map((a) => a.id), category.id, 'PF-886 Cap Test Purchase', count, 10, merchant.id
    );

    // one day per transaction, today back through `count - 1` days ago
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (count - 1));
    const iso = (d: Date): string => d.toISOString().split('T')[0];
    const range = `startDate=${iso(start)}&endDate=${iso(end)}&range=Custom`;

    await page.goto(`/reports?measure=SPENDING&groupBy=CATEGORY&${range}`);
    await expect(row(page, parent.name)).toContainText('$12,000.00');

    // the merchant grouping also shows a count, the stronger check: 1000 vs 1,200 can't be mistaken
    await page.goto(`/reports?measure=SPENDING&groupBy=MERCHANT&${range}`);
    const merchantRow = row(page, merchant.name);
    await expect(merchantRow).toContainText('$12,000.00');
    await expect(merchantRow).toContainText('1200');
  });
});
