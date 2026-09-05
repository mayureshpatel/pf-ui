import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory, createTestTag, createTestTransaction} from './helpers/api';

/**
 * Covers the PF-308 flow end-to-end against the real stack: assigning a tag in the edit drawer
 * renders it as a pill on the row, and the Tags column filter actually narrows the ledger to
 * matching transactions (not just a no-op) -- `otherTxn` below stays untagged specifically to
 * prove the filter excludes it, rather than the assertion trivially passing either way.
 */
test.describe('Transaction Tags', () => {
  test('assigning a tag in the edit drawer shows it as a pill and filters the ledger (PF-308)', async ({page}) => {
    await page.goto('/transactions');
    const account = await createTestAccount(page, 'E2E Tag Account');
    // transactions can only carry a subcategory, not a top-level parent -- create both
    const parentCategory = await createTestCategory(page, 'E2E Parent Category');
    const category = await createTestCategory(page, 'E2E Category', parentCategory.id);
    const tag = await createTestTag(page, 'E2E Travel');
    const taggedTxn = await createTestTransaction(page, account.id, category.id, 'E2E Tagged Txn');
    const otherTxn = await createTestTransaction(page, account.id, category.id, 'E2E Untagged Txn');

    await page.reload();
    const row = page.getByRole('row', {name: new RegExp(taggedTxn.description)});
    await row.locator('button:has(.pi-pencil)').click();

    // app-drawer renders PrimeNG's p-drawer (a side panel), which uses role="complementary" --
    // confirmed in account-reconciliation.spec.ts for this same shared component.
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'Edit Transaction'})).toBeVisible();

    // The tags p-multiSelect's overlay panel renders in a CDK-style portal appended outside the
    // drawer's own DOM subtree (same behavior already proven for p-select in csv-import.spec.ts),
    // so the option is queried unscoped at the page level, not via drawer.
    await drawer.getByText('Add tags...').click();
    await page.getByRole('option', {name: tag.name, exact: true}).click();

    // Multi-select overlays don't auto-close on pick. Close it via a neutral, non-widget click
    // inside the drawer (not Escape -- that risks bubbling up and dismissing the drawer itself)
    // before clicking Save, in case the still-open panel visually covers the footer button.
    await drawer.getByRole('heading').click();
    await drawer.getByRole('button', {name: 'Update Record'}).click();

    await expect(page.getByText('Transaction updated')).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(row.getByText(tag.name, {exact: true})).toBeVisible();

    // Filter the ledger down to just this tag via the Tags column's filter menu.
    const tagsHeader = page.locator('#txn-tags');
    await tagsHeader.getByRole('button', {name: 'Show Filter Menu'}).click();
    await page.getByText('Select Tag').click();
    await page.getByRole('option', {name: tag.name, exact: true}).click();
    await page.getByRole('button', {name: 'Apply'}).click();

    await expect(page.getByText(taggedTxn.description).first()).toBeVisible();
    await expect(page.getByText(otherTxn.description)).not.toBeVisible();
  });
});
