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
 * running PF-825's fix. The exact count (2,594 as of this writing) reflects this session's seeded
 * dataset after some transactions were subsequently categorized by other in-session testing --
 * re-verify the real count via `GET /transactions?type=EXPENSE&categoryName=null` rather than
 * assuming this number stays fixed if the seed data changes again.
 */
test.describe('Dashboard - Action Center count', () => {
  test('the UNCATEGORIZED action item displays the real transaction count, not a dollar sum', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const actionCenter = page.locator('p-card', { hasText: 'Action Center' });
    await expect(actionCenter.getByText('Uncategorized expenses found')).toBeVisible();
    await expect(actionCenter.getByText('2594 unresolved items')).toBeVisible();
  });
});
