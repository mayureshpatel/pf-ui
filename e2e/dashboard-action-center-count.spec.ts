import { expect, test } from '@playwright/test';

/**
 * PF-825 fixed: `ActionItemDto.count` for the UNCATEGORIZED action item used to be the
 * uncategorized-expense dollar sum truncated to a long (`getUncategorizedExpenseTotals()`), not a
 * real transaction count -- confirmed live pre-fix, the Dashboard displayed "425239 unresolved
 * items" for a $425,239.xx total. `DashboardService.getActionItems()` now uses a real
 * `getUncategorizedExpenseCount()` query instead. This test originally documented the bug
 * (asserted the wrong dollar-derived value); inverted here to assert the fix, per this project's
 * TDD-for-bugs mandate.
 *
 * Requires the E2E_USERNAME test user to have real uncategorized expense data and a backend
 * running PF-825's fix. The real count is read from the Transactions page itself (the same
 * `type=EXPENSE&categoryName=null` filter the banner links to) instead of being hard-coded, because
 * other specs (for example the CSV import) add uncategorized rows to this shared user on every run.
 */
test.describe('Dashboard - review banner count', () => {
  test('the UNCATEGORIZED action item displays the real transaction count, not a dollar sum', async ({
    page,
  }) => {
    // the real number of uncategorized expenses, as the Transactions page reports it
    await page.goto('/transactions?type=EXPENSE&categoryName=null');
    const resultLine = page.getByTestId('result-line');
    await expect(resultLine).toContainText('transactions match');
    const count = (await resultLine.innerText()).split(' ')[0];

    await page.goto('/dashboard');

    const banner = page.getByRole('region', { name: 'Needs your review' });
    await expect(
      banner.getByRole('button', { name: `${count} uncategorized expenses` }),
    ).toBeVisible();
  });
});
