import {expect, test} from './fixtures/test';
import {deleteTestTagsContaining} from './helpers/api';

/**
 * Covers PF-309 and PF-889: tag management from Settings > Tags through the docked panel -- add a tag,
 * rename it, follow it to the Transactions page, then delete it with confirmation. Uses the shared dev
 * user and removes its own tag at the end.
 */
test.describe('Tag Management', () => {
  let stamp = '';

  // The UI delete at the end of the test is part of what it checks, but a step failing midway would
  // leave the tag behind on the shared dev user, so remove whatever is left through the API.
  test.afterEach(async ({page}) => {
    if (stamp) await deleteTestTagsContaining(page, stamp);
  });

  test('add, rename, view and delete a tag from the Settings page', async ({page}) => {
    stamp = String(Date.now());
    const tagName = `E2E Tag ${stamp}`;
    const renamedTagName = `${tagName} Renamed`;

    await page.goto('/settings?section=tags');
    const panel = page.getByRole('complementary');

    // add
    await page.getByRole('button', {name: 'Add tag'}).first().click();
    await panel.locator('#tag-name').fill(tagName);
    await panel.getByRole('button', {name: 'Add tag'}).click();
    await expect(page.getByText('Tag added')).toBeVisible();
    const row = page.locator('[data-tag-row]', {hasText: tagName});
    await expect(row).toBeVisible();
    await expect(row).toContainText('#3b82f6');

    // rename
    await expect(panel.locator('#tag-name')).toHaveValue(tagName);
    await panel.locator('#tag-name').fill(renamedTagName);
    await panel.getByRole('button', {name: 'Save changes'}).click();
    await expect(page.getByText('Tag saved')).toBeVisible();
    const renamedRow = page.locator('[data-tag-row]', {hasText: renamedTagName});
    await expect(renamedRow).toBeVisible();

    // follow it to the Transactions page
    await panel.getByRole('button', {name: 'View transactions'}).click();
    await expect(page).toHaveURL(/\/transactions\?.*tagId=/);
    await page.goBack();

    // delete, with confirmation
    await page.locator('[data-tag-row]', {hasText: renamedTagName}).click();
    await panel.getByRole('button', {name: 'Delete tag'}).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog.getByText('also removed from any transactions that carry it')).toBeVisible();
    await confirmDialog.getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Tag deleted')).toBeVisible();
    await expect(page.locator('[data-tag-row]', {hasText: renamedTagName})).toHaveCount(0);
  });
});
