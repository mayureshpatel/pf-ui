import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-334: category-rule creation through the real UI, and the apply-rules preview/commit
 * flow -- create a rule, seed an uncategorized transaction whose description matches its keyword,
 * apply the ruleset, and confirm the transaction shows up in the real preview ledger and gets
 * categorized. Uses a brand-new registered user so "Apply Rules" only ever sees this test's own
 * seeded data, not months of the shared dev user's accumulated (already-categorized) history.
 *
 * category-rule-form-dialog is a drawer (migrated from p-dialog by PF-803); apply-rules-dialog is
 * still a real p-dialog (no formControlName/p-select inside it, so unaffected by that bug).
 */
test.describe('Settings — Category Rules', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('create a rule through the real UI, then preview and commit applying it', async ({page}) => {
    await registerTestUser(page);

    // Rules (like budgets) can only target a subcategory, not a bare top-level category.
    const parentCategory = await createTestCategory(page, 'E2E Rule Parent');
    const category = await createTestCategory(page, 'E2E Rule Category', parentCategory.id);
    const account = await createTestAccount(page, 'E2E Rule Account');

    const keyword = `TESTKEYWORD${Date.now()}`;
    const transaction = await createTestTransaction(page, account.id, undefined, keyword, {amount: 42.5});

    await page.goto('/settings');

    // Create the rule through the real UI
    await page.getByRole('button', {name: 'New Rule'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByText('Add Category Rule')).toBeVisible();

    await drawer.locator('#keywords').fill(keyword);
    await drawer.getByText('Select target category').click();
    await page.getByRole('option', {name: category.name}).click();
    await drawer.getByRole('button', {name: 'Create Rule'}).click();

    await expect(page.getByText('Category rule created.')).toBeVisible();
    await expect(drawer).toBeHidden();

    const ruleRow = page.getByRole('row', {name: new RegExp(keyword)});
    await expect(ruleRow).toBeVisible();
    await expect(ruleRow.getByText(category.name)).toBeVisible();

    // Apply Rules: preview shows the real seeded transaction, then commit
    await page.getByRole('button', {name: 'Apply Rules'}).click();
    const applyDialog = page.getByRole('dialog');
    await expect(applyDialog.getByText('Apply Category Rules')).toBeVisible();
    await expect(applyDialog.getByText('1 Transaction Identified')).toBeVisible();
    await expect(applyDialog.getByText(transaction.description)).toBeVisible();
    // Backend sends the literal string "Uncategorized" as the old value for previously
    // uncategorized transactions, not a blank/null sentinel -- renders via the truthy branch
    // (struck through), not apply-rules-dialog's "Unset" fallback for a genuinely empty oldValue.
    await expect(applyDialog.getByText('Uncategorized')).toBeVisible();
    await expect(applyDialog.getByText(category.name)).toBeVisible();

    await applyDialog.getByRole('button', {name: 'Commit Changes'}).click();
    await expect(page.getByText('Rules successfully applied to transactions.')).toBeVisible();
    await expect(applyDialog).toBeHidden();
  });
});
