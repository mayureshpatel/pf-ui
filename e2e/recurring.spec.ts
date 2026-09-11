import {expect, test} from '@playwright/test';
import {createTestAccount, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-335: creating a recurring transaction manually through the real UI, verifying it
 * appears in the list with the correct schedule, and the recurring-suggestions flow's primary
 * path -- accepting a detected pattern. Uses a brand-new registered user so pattern detection
 * only ever sees this test's own seeded data.
 *
 * recurring-form-dialog is a drawer (migrated from p-dialog by PF-281, prompted by the identical
 * bug PF-803 found and fixed in budget-form-dialog/category-rule-form-dialog); the suggestions
 * dialog itself has no formControlName/p-select, so it was never affected.
 *
 * There's no per-row "dismiss" in this UI, only "Accept" (per suggestion) and "Close" (the whole
 * dialog, declining every suggestion) -- covering Accept as the primary path per the AC.
 *
 * Merchants have no direct create endpoint; TransactionService.findOrCreateMerchant() derives one
 * from a transaction's description automatically, so seeding transactions is how test merchants
 * get created here.
 */
test.describe('Recurring', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('create a recurring entry manually, then accept a detected suggestion', async ({page}) => {
    await registerTestUser(page);
    const account = await createTestAccount(page, 'E2E Recurring Account');

    // Pattern detection needs >= 3 same-merchant, same-amount EXPENSE transactions at a stable
    // ~monthly interval, all within the last 12 months. Three prior months, day 15, comfortably
    // clears both the lookback window and the detector's day-gap stability tolerance.
    //
    // No timestamp suffix here (unlike every other test's naming, e.g. createTestAccount's own
    // uniqueness suffix): MerchantNameNormalizer strips trailing numeric groups entirely, so a
    // baked-in Date.now() never survives into the merchant's cleanName -- confirmed live, it
    // doesn't serve the uniqueness purpose it would elsewhere. Harmless collision risk regardless,
    // since every test run uses a brand-new registered user with no prior merchants.
    const now = new Date();
    const suggestionMerchantPrefix = 'E2E Suggestion Merchant';
    for (let monthsAgo = 3; monthsAgo >= 1; monthsAgo--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 15)).toISOString();
      await createTestTransaction(page, account.id, undefined, suggestionMerchantPrefix, {
        amount: 75, type: 'EXPENSE', transactionDate: date
      });
    }

    // A second, unrelated merchant for the manual-creation flow -- kept distinct from the
    // suggestion merchant so accepting the suggestion later isn't affected by an already-active
    // recurring entry on the same merchant (findSuggestions() excludes those).
    await createTestTransaction(page, account.id, undefined, 'E2E Manual Merchant', {amount: 20});

    await page.goto('/recurring');

    // Manual creation through the real UI
    await page.getByRole('button', {name: 'New Recurring'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByText('Create Recurring Entry')).toBeVisible();

    await drawer.getByText('Search for a merchant').click();
    await page.getByRole('option', {name: 'E2E Manual Merchant'}).click();
    await drawer.getByRole('spinbutton').fill('55');
    await drawer.getByText('How often?').click();
    await page.getByRole('option', {name: 'Weekly', exact: true}).click();
    await drawer.getByText('Select account').click();
    await page.getByRole('option', {name: account.name}).click();
    // p-datepicker doesn't commit a typed value to the form control on a plain .fill() -- drive
    // its real calendar UI instead. Jumping to next month and picking day 1 sidesteps needing to
    // know today's date within the current month (always in the future, always a real day, never
    // an other-month overflow cell).
    await drawer.locator('#nextDate input').click();
    await page.getByRole('button', {name: 'Next Month'}).click();
    await page.locator('td.p-datepicker-day-cell:not(.p-datepicker-other-month)').getByText('1', {exact: true}).click();
    await drawer.getByRole('button', {name: 'Create Entry'}).click();

    await expect(page.getByText('Recurring entry created')).toBeVisible();
    await expect(drawer).toBeHidden();

    // Case-insensitive: MerchantNameNormalizer doesn't preserve casing exactly (e.g. "E2E" -> "E2e").
    const manualRow = page.getByRole('row', {name: /E2E Manual Merchant/i});
    await expect(manualRow).toBeVisible();
    await expect(manualRow.getByText('$55.00')).toBeVisible();
    await expect(manualRow.getByText('Weekly')).toBeVisible();
    await expect(manualRow.getByText('Active')).toBeVisible();

    // Suggestions: accept the detected pattern (primary path -- no per-item dismiss exists, only
    // Accept or closing the whole dialog)
    await page.getByRole('button', {name: 'View Suggestions'}).click();
    const suggestionsDialog = page.getByRole('dialog');
    await expect(suggestionsDialog.getByText('Detected Recurring Patterns')).toBeVisible();

    const suggestionRow = page.getByRole('row', {name: new RegExp(suggestionMerchantPrefix, 'i')});
    await expect(suggestionRow).toBeVisible();
    await expect(suggestionRow.getByText('$75.00')).toBeVisible();
    await expect(suggestionRow.getByText('Monthly')).toBeVisible();

    // The button's explicit ariaLabel overrides its accessible name -- "Accept" is only the
    // visible label text, not what getByRole searches by.
    await suggestionRow.getByRole('button', {name: 'Create recurring entry from this pattern'}).click();
    await expect(suggestionsDialog).toBeHidden();

    // Accepting pre-fills amount/frequency/date but not merchant -- the suggestion's merchant has
    // no real id, only a display name, so it still needs a real selection to save. Account is
    // left over from the manual-creation flow above (the drawer's underlying form instance isn't
    // recreated between opens) and happens to already be correct, so no need to reselect it.
    await expect(drawer.getByText('Create Recurring Entry')).toBeVisible();
    await drawer.getByText('Search for a merchant').click();
    await page.getByRole('option', {name: new RegExp(suggestionMerchantPrefix, 'i')}).click();
    await drawer.getByRole('button', {name: 'Create Entry'}).click();

    await expect(page.getByText('Recurring entry created')).toBeVisible();
    await expect(drawer).toBeHidden();

    const suggestionEntryRow = page.getByRole('row', {name: new RegExp(suggestionMerchantPrefix, 'i')});
    await expect(suggestionEntryRow).toBeVisible();
    await expect(suggestionEntryRow.getByText('$75.00')).toBeVisible();
    await expect(suggestionEntryRow.getByText('Monthly')).toBeVisible();
  });
});
