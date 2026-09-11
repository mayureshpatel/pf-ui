import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-331: the dashboard's primary flow, asserted against real seeded data rather than just
 * "the page didn't crash." Uses a brand-new registered user (not the shared dev user) so the
 * numbers are exact and deterministic -- the shared user has months of accumulated E2E data that
 * would make asserting a specific total fragile.
 */
test.describe('Dashboard', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('summary cards, cash-flow chart, category chart, and action center reflect real data', async ({page}) => {
    await registerTestUser(page);

    const account = await createTestAccount(page, 'E2E Dashboard Account');
    const parentCategory = await createTestCategory(page, 'E2E Dashboard Parent');
    const category = await createTestCategory(page, 'E2E Dashboard Category', parentCategory.id);

    // Dashboard defaults to LAST_MONTH -- dated within August 2026 relative to today (2026-09-05).
    const lastMonthDate = '2026-08-15T00:00:00Z';
    await createTestTransaction(page, account.id, category.id, 'E2E Dashboard Income', {
      amount: 2000, type: 'INCOME', transactionDate: lastMonthDate
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Dashboard Expense', {
      amount: 500, type: 'EXPENSE', transactionDate: lastMonthDate
    });
    // Uncategorized on purpose, to trigger the action center's UNCATEGORIZED item -- that check
    // is global (not period-scoped), so its own date doesn't need to fall in "last month" too.
    const uncategorized = await createTestTransaction(page, account.id, undefined, 'E2E Dashboard Uncategorized', {
      amount: 50, type: 'EXPENSE', transactionDate: lastMonthDate
    });

    await page.goto('/dashboard');

    // Pulse cards -- scoped to the app-pulse-card element itself (not a DOM-climbing '..', which
    // is ambiguous here: app-ytd-summary separately renders the same 72.5% savings rate for the
    // same clean-slate data, and a '..' hop lands too high to exclude it).
    const incomeCard = page.locator('app-pulse-card').filter({hasText: 'Total Income'});
    await expect(incomeCard.getByText('$2,000.00')).toBeVisible();
    const expenseCard = page.locator('app-pulse-card').filter({hasText: 'Total Expenses'});
    await expect(expenseCard.getByText('$550.00')).toBeVisible();
    const savingsCard = page.locator('app-pulse-card').filter({hasText: 'Savings Rate'});
    await expect(savingsCard.getByText('72.5%')).toBeVisible();

    // Charts render (canvas-backed p-chart; content isn't practically assertable, presence is)
    await expect(page.getByText('Top Categories')).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
    const categoryChartCanvasCount = await page.locator('canvas').count();
    expect(categoryChartCanvasCount).toBeGreaterThanOrEqual(2); // cash-flow-trend + category-chart

    // Action center: the uncategorized expense above must surface here, and clicking through
    // must both land on and actually filter the Transactions page down to it. Bug regression:
    // the backend used to build this route as "?category=null", but TransactionsComponent only
    // ever reads "categoryName" off the URL -- the unrecognized param was silently dropped, and
    // the component's own URL-sync effect then replaced the URL with an empty query string on
    // load, so the button appeared to work but never actually filtered anything.
    const actionButton = page.getByRole('button', {name: /Uncategorized expenses found/});
    await expect(actionButton).toBeVisible();
    await actionButton.click();
    await expect(page).toHaveURL(/\/transactions\?categoryName=null/);
    await expect(page.getByText(uncategorized.description)).toBeVisible();
    await expect(page.getByText('E2E Dashboard Income', {exact: false})).not.toBeVisible();
    await expect(page.getByText('E2E Dashboard Expense', {exact: false})).not.toBeVisible();
  });
});
