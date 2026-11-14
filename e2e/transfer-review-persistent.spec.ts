import {expect, test} from './fixtures/test';
import {createTestAccount, createTestTransaction} from './helpers/api';

/**
 * PF-831: the Dashboard's TRANSFER_REVIEW action item links to
 * `/transactions?action=review-transfers`, but `TransactionsComponent` never read an `action`
 * query param at all -- `TransactionUrlStateService.hydrateFromParams()` only recognizes the
 * filter/sort/pagination params it owns, so the link silently did nothing. Also, the transfer
 * review dialog previously only ever opened automatically right after a CSV import finished, with
 * no other entry point -- fixed by adding an entry point on the Transactions page and wiring the
 * dead link to it.
 *
 * PF-949: the entry point was a "Review Transfers" button that was always visible; the page rebuild
 * (2026-10-23) replaced it with a "N possible transfers, review" pill that only shows when the
 * matcher has something to review, so the second test seeds a pair instead of expecting a button.
 */
test.describe('Transfer review - persistent entry point', () => {
  test('navigating with ?action=review-transfers opens the transfer dialog, matching the Dashboard action item', async ({
    page,
  }) => {
    await page.goto('/transactions?action=review-transfers');

    await expect(page.getByRole('dialog', { name: 'Internal Transfer Reconciliation' })).toBeVisible();
  });

  test('a possible transfer shows a review pill on the Transactions page that opens the dialog', async ({
    page,
  }) => {
    // Equal amount, opposite type, different account, same day: the matcher's own definition of a
    // possible transfer (TransferMatcher), so the pill must appear whatever else the user has.
    const out = await createTestAccount(page, 'E2E Transfer Out');
    const into = await createTestAccount(page, 'E2E Transfer In');
    const today = new Date().toISOString();
    await createTestTransaction(page, out.id, undefined, 'E2E Transfer out', {
      amount: 111.11,
      type: 'EXPENSE',
      transactionDate: today,
    });
    await createTestTransaction(page, into.id, undefined, 'E2E Transfer in', {
      amount: 111.11,
      type: 'INCOME',
      transactionDate: today,
    });

    await page.goto('/transactions');

    const reviewPill = page.getByRole('button', { name: /possible transfers, review$/ });
    await expect(reviewPill).toBeVisible();

    await reviewPill.click();
    await expect(page.getByRole('dialog', { name: 'Internal Transfer Reconciliation' })).toBeVisible();
  });
});
