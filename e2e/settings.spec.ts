import {expect, test} from '@playwright/test';
import {createTestAccount, createTestCategory, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-889: the Settings page through the real UI -- a category rule added, edited, previewed,
 * applied and deleted in the docked panel, and the theme chooser. Uses a brand-new registered user so
 * "Apply rules" only ever sees this test's own seeded data, not the shared dev user's history.
 * Rules (like budgets) can only target a subcategory.
 */
test.describe('Settings', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('add, edit, apply and delete a category rule', async ({page}) => {
    await registerTestUser(page);

    const parentCategory = await createTestCategory(page, 'E2E Rule Parent');
    const category = await createTestCategory(page, 'E2E Rule Category', parentCategory.id);
    const account = await createTestAccount(page, 'E2E Rule Account');

    const keyword = `TESTKEYWORD${Date.now()}`;
    const transaction = await createTestTransaction(page, account.id, undefined, keyword, {amount: 42.5});

    await page.goto('/settings?section=rules');
    const panel = page.getByRole('complementary');

    // add
    await page.getByRole('button', {name: 'Add rule'}).first().click();
    await expect(panel).toHaveAccessibleName('Add rule');
    await panel.locator('#rule-keywords').fill(keyword);
    await panel.getByRole('combobox', {name: 'Category'}).click();
    await page.getByRole('option', {name: category.name}).click();
    await panel.getByRole('button', {name: 'Add rule'}).click();

    await expect(page.getByText('Rule added')).toBeVisible();
    await expect(panel).toHaveAccessibleName('Edit rule');
    const row = page.locator('[data-rule-row]', {hasText: keyword});
    await expect(row).toContainText(category.name);
    await expect(row).toContainText('Priority 0');

    // edit (new: a rule can be changed in place)
    await panel.locator('#rule-priority').fill('4');
    await panel.getByRole('button', {name: 'Save changes'}).click();
    await expect(page.getByText('Rule saved')).toBeVisible();
    await expect(row).toContainText('Priority 4');

    // apply: the preview shows the seeded transaction, then commit
    await page.getByRole('button', {name: 'Apply rules'}).first().click();
    const applyDialog = page.getByRole('dialog');
    await expect(applyDialog.getByText('Apply Category Rules')).toBeVisible();
    await expect(applyDialog.getByText('1 Transaction Identified')).toBeVisible();
    await expect(applyDialog.getByText(transaction.description)).toBeVisible();
    await expect(applyDialog.getByText('Uncategorized')).toBeVisible();
    await expect(applyDialog.getByText(category.name)).toBeVisible();
    await applyDialog.getByRole('button', {name: 'Commit Changes'}).click();
    await expect(page.getByText('Rules successfully applied to transactions.')).toBeVisible();
    await expect(applyDialog).toBeHidden();

    // delete, with confirmation
    await panel.getByRole('button', {name: 'Delete rule'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();
    await expect(page.getByText('Rule deleted')).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('choose a theme, keep it after a reload, and deep link to a section', async ({page}) => {
    await registerTestUser(page);

    await page.goto('/settings?section=appearance');
    await expect(page.getByRole('radiogroup', {name: 'Theme'})).toBeVisible();
    await page.getByText('Dark', {exact: true}).click();
    await expect(page.locator('html')).toHaveClass(/my-app-dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/my-app-dark/);
    await expect(page.getByRole('radio', {name: 'Dark'})).toBeChecked();

    await page.getByText('Light', {exact: true}).click();
    await expect(page.locator('html')).not.toHaveClass(/my-app-dark/);

    // the section is in the URL, and the list moves between sections
    await page.getByRole('button', {name: 'Tags'}).click();
    await expect(page).toHaveURL(/section=tags/);
    await expect(page.getByRole('heading', {name: 'Tags'})).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/section=appearance/);
  });
});
