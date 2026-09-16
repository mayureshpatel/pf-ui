import { expect, test } from '@playwright/test';
import {
  createTestAccountsBulk,
  createTestCategory,
  createTestTransactionsBulk,
  registerTestUser,
} from './helpers/api';

/**
 * PF-823: equivalent regression coverage to reports-transaction-cap.spec.ts's Cash Flow test, but
 * for the Categories and Merchants tabs specifically -- each tab aggregates independently
 * server-side now, so each deserves its own direct proof rather than inferring correctness from
 * Cash Flow alone.
 *
 * Uses a fresh, isolated user (unlike the Cash Flow spec, which relies on the shared E2E_USERNAME's
 * real imported bank data) so the expected total is exact and known up front: 1,200 identical $10
 * expenses -- comfortably past the old 1000-row cap -- all sharing one category and one merchant
 * (same description normalizes to the same merchant name). Old buggy behavior would have shown
 * $10,000.00 (the newest 1000 of them); the fix shows the true $12,000.00.
 */
test.describe('Reports - Categories/Merchants transaction cap', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Categories and Merchants both reflect all 1,200 transactions, not just the newest 1000', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await registerTestUser(page);
    // Spread across several accounts, not one -- see createTestTransactionsBulk's own doc comment
    // for why a single shared account can't safely take the concurrent writes this needs to stay fast.
    const accounts = await createTestAccountsBulk(page, 'PF-823 Cap Test Account', 20);
    // Only subcategories can be assigned to transactions -- a parent-less category is rejected.
    const parentCategory = await createTestCategory(page, 'PF-823 Cap Test Parent');
    const category = await createTestCategory(page, 'PF-823 Cap Test Category', parentCategory.id);

    const count = 1200;
    const amount = 10;
    await createTestTransactionsBulk(
      page,
      accounts.map((a) => a.id),
      category.id,
      'PF-823 Cap Test Vendor',
      count,
      amount,
    );

    // One day per transaction, oldest first -- covers today back through `count - 1` days ago.
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (count - 1));
    const toIso = (d: Date): string => d.toISOString().split('T')[0];

    await page.goto(
      `/reports?startDate=${toIso(startDate)}&endDate=${toIso(today)}&label=Custom%20Range`,
    );

    // Categories tab (default active)
    const categoryRow = page.getByRole('row', { name: new RegExp(category.name) });
    await expect(categoryRow).toBeVisible();
    await expect(categoryRow.getByText('$12,000.00')).toBeVisible();
    await expect(categoryRow.getByText('$10.00')).toBeVisible(); // avg/txn -- constant regardless of count

    // Merchants tab -- unlike Categories, its table shows an explicit transaction count, so this
    // is the stronger of the two assertions: 1000 would silently read as a plausible-looking
    // (but wrong) total on its own, but 1000 vs. 1,200 in the Txns column can't be mistaken for
    // anything but the row cap.
    await page.getByRole('tab', { name: 'Merchants' }).click();
    const merchantRow = page.getByRole('row', { name: /PF-823 Cap Test Vendor/i });
    await expect(merchantRow).toBeVisible();
    await expect(merchantRow.getByText('$12,000.00')).toBeVisible();
    await expect(merchantRow.getByText('1200', { exact: true })).toBeVisible();
  });
});
