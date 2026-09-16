import { expect, test } from '@playwright/test';

/**
 * Regression coverage for PF-823: a silent data-truncation bug in Reports. `reports.component.ts`'s
 * old `loadTransactions()` requested `GET /transactions` with a hard-coded `page: 0, size: 1000`
 * and did `this.transactions.set(page.content)` -- it never inspected `page.totalElements`.
 * Categories, Merchants, and Cash Flow all derived from this one client-side-aggregated signal, so
 * any selected date range whose matching transactions exceeded 1000 silently dropped everything
 * past the newest 1000 (the request sorted `date,desc`), with no warning, error, or truncation
 * indicator anywhere in the UI. Net Worth was unaffected -- it's computed server-side by the
 * separate `/reports/net-worth` endpoint, and was never fed by this capped array.
 *
 * Fixed by moving all three aggregations server-side (`ReportController`'s `/categories`,
 * `/merchants`, `/monthly` endpoints) -- no row cap, no page size, correct at any scale.
 *
 * Requires the E2E_USERNAME test user to already have over 1000 transactions within
 * 2022-01-01..2024-12-31 -- true as of this writing (2,022 transactions in that range) after
 * importing pf-data-service's own `src/test/resources/sample-imports/` bank CSVs (PF-EPIC-017's
 * real fixture data: Capital One, Discover, Synovus). If that seed data isn't present, this test's
 * premise doesn't hold; re-seed it rather than "fixing" the test to pass without it.
 */
test.describe('Reports - transaction cap', () => {
  test('a date range with over 1000 transactions includes the oldest months in Cash Flow', async ({
    page,
  }) => {
    // Bypasses the p-datePicker calendar UI (impractical to drive for a 3-year range) by going
    // straight to the URL shape reports.component.ts itself produces for a shared/bookmarked
    // range -- hydrateFromParams() reads these same three params on load.
    await page.goto('/reports?startDate=2022-01-01&endDate=2024-12-31&label=Custom%20Range');

    await page.getByRole('tab', { name: 'Cash Flow' }).click();
    await expect(page.getByText('Monthly Performance')).toBeVisible();

    // The newest month in range was always safe under the old cap -- the capped page sorted
    // date,desc, so it was among the first 1000 rows no matter how much data existed. Still
    // confirms the range/data loaded correctly post-fix.
    await expect(page.getByRole('cell', { name: '2024-12', exact: true })).toBeVisible();

    // The oldest month in range: this is exactly what the old 1000-row cap silently dropped.
    // Real data for a selected, in-range month is no longer missing.
    await expect(page.getByRole('cell', { name: '2022-01', exact: true })).toBeVisible();
  });
});
