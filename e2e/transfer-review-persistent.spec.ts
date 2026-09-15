import { expect, test } from '@playwright/test';

/**
 * PF-831: the Dashboard's TRANSFER_REVIEW action item links to
 * `/transactions?action=review-transfers`, but `TransactionsComponent` never read an `action`
 * query param at all -- `TransactionUrlStateService.hydrateFromParams()` only recognizes the
 * filter/sort/pagination params it owns, so the link silently did nothing. Also, the transfer
 * review dialog previously only ever opened automatically right after a CSV import finished, with
 * no other entry point -- fixed by adding a persistent "Review Transfers" button and wiring the
 * dead link to it.
 */
test.describe('Transfer review - persistent entry point', () => {
  test('navigating with ?action=review-transfers opens the transfer dialog, matching the Dashboard action item', async ({
    page,
  }) => {
    await page.goto('/transactions?action=review-transfers');

    await expect(page.getByRole('dialog', { name: 'Internal Transfer Reconciliation' })).toBeVisible();
  });

  test('the "Review Transfers" button is always visible on the Transactions page, not just after an import', async ({
    page,
  }) => {
    await page.goto('/transactions');

    const reviewButton = page.getByRole('button', { name: 'Review Transfers' });
    await expect(reviewButton).toBeVisible();

    await reviewButton.click();
    await expect(page.getByRole('dialog', { name: 'Internal Transfer Reconciliation' })).toBeVisible();
  });
});
