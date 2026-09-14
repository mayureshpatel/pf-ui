import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-336: selecting a date range via the shared date-range-filter, and each of the 4
 * current sub-reports (Categories, Merchants, Cash Flow -- "vendor-report" in the ticket's own
 * text is stale; the component itself is already named merchant-report, confirmed against the
 * live tree -- and Net Worth, PF-305) rendering real data for that range. Uses a brand-new
 * registered user so the report totals are exact -- Categories/Merchants/Cash Flow all share one
 * already-fetched transactions() signal, so one small, deliberately-chosen seed set drives every
 * assertion in this spec. Net Worth is independently backend-computed (PF-304's
 * `/reports/net-worth`, not a client-side aggregation of that same array) but starts from the
 * same account, so its balance is still exactly derivable from the same seed.
 */
test.describe('Reports', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('date range filter and all 4 sub-reports render real seeded data', async ({page}) => {
    await registerTestUser(page);

    // createTestAccount seeds a $1,000 starting balance -- Net Worth's assertion below depends
    // on this exact figure, not just the transaction totals the other 3 tabs check.
    const account = await createTestAccount(page, 'E2E Reports Account');
    const parentCategory = await createTestCategory(page, 'E2E Reports Parent');
    const category = await createTestCategory(page, 'E2E Reports Category', parentCategory.id);

    // Reports default to "Last 3 Months" -- dated today so they fall inside that window
    // regardless of which day of the month the suite runs on.
    const today = new Date().toISOString();
    await createTestTransaction(page, account.id, category.id, 'E2E Reports Merchant', {
      amount: 100, type: 'EXPENSE', transactionDate: today
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Reports Merchant', {
      amount: 50, type: 'EXPENSE', transactionDate: today
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Reports Income', {
      amount: 500, type: 'INCOME', transactionDate: today
    });

    await page.goto('/reports');

    // Date range filter: explicitly select "This Month".
    //
    // Bug regression: this used to come back completely empty. reports.component.ts and
    // date-range-filter.component.ts both built the range's end date via
    // `date.toISOString().split('T')[0]` (UTC-based), which is correct in isolation, but
    // loadTransactions() then re-parsed that string via `new Date(dateString)` -- always UTC
    // midnight, regardless of local timezone -- and that Date was reformatted through the
    // *correct* `toLocalDateString()` utility (built to fix this exact class of bug, PF-199) a
    // second time. The round trip silently rolled "today" back to yesterday for any user in a
    // negative UTC offset (the Americas), so a transaction dated "right now" fell outside every
    // preset's own end boundary. Fixed in both files (and loadTransactions()'s parse) to use
    // toLocalDateString()/fromLocalDateString() throughout instead of ever touching
    // toISOString() or the bare Date(string) constructor for a local calendar date.
    await page.getByRole('button', {name: 'This Month'}).click();

    // Categories tab (default active)
    const categoryRow = page.getByRole('row', {name: new RegExp(category.name)});
    await expect(categoryRow).toBeVisible();
    await expect(categoryRow.getByText('$150.00')).toBeVisible(); // total: 100 + 50
    await expect(categoryRow.getByText('$75.00')).toBeVisible(); // avg: 150 / 2

    // Merchants tab
    await page.getByRole('tab', {name: 'Merchants'}).click();
    // MerchantNameNormalizer doesn't preserve casing exactly (e.g. "E2E" -> "E2e").
    const merchantRow = page.getByRole('row', {name: /E2E Reports Merchant/i});
    await expect(merchantRow).toBeVisible();
    await expect(merchantRow.getByText('$150.00')).toBeVisible();
    await expect(merchantRow.getByText('2', {exact: true})).toBeVisible(); // txn count

    // Cash Flow tab (income/expense report)
    await page.getByRole('tab', {name: 'Cash Flow'}).click();
    await expect(page.getByText('Monthly Performance')).toBeVisible();
    const monthRow = page.getByRole('table').locator('tbody tr').first();
    await expect(monthRow.getByText('$500.00')).toBeVisible(); // income
    await expect(monthRow.getByText('$150.00')).toBeVisible(); // expenses
    await expect(monthRow.getByText('$350.00')).toBeVisible(); // net savings: 500 - 150

    // Net Worth tab (PF-305): $1,000 starting balance + 500 income - 100 - 50 expenses = $1,350.
    // The account and every seed transaction were created moments ago (this test run), so "This
    // Month" produces exactly one backend data point -- its value is also the headline figure.
    await page.getByRole('tab', {name: 'Net Worth'}).click();
    await expect(page.getByText('Net Worth Over Time')).toBeVisible();
    await expect(page.getByText('$1,350.00')).toBeVisible();
  });
});
