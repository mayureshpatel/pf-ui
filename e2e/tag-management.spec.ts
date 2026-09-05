import {expect, test} from '@playwright/test';

/**
 * Covers PF-309 (dedicated tag management page) end-to-end against the real stack: create a tag
 * from the Settings > Tags page, rename it, then delete it with confirmation -- entirely through
 * the UI, since managing tags directly (not from inside a transaction) is this feature's whole
 * point. Color isn't explicitly picked here (the p-colorPicker's canvas-based overlay isn't a
 * meaningful thing to drive via automation) -- the default color's round-trip through create,
 * list display, and rename already exercises the '#'-stripping/prepending logic end to end.
 */
test.describe('Tag Management', () => {
  test('create, rename, and delete a tag from the Settings page', async ({page}) => {
    const tagName = `E2E Tag ${Date.now()}`;
    const renamedTagName = `${tagName} Renamed`;

    await page.goto('/settings');
    await page.getByRole('tab', {name: 'Tags'}).click();

    // Create
    await page.getByRole('button', {name: 'New Tag'}).click();
    const dialog = page.getByRole('dialog', {name: 'New Tag'});
    await dialog.locator('#tag-name').fill(tagName);
    await dialog.getByRole('button', {name: 'Create Tag'}).click();

    await expect(page.getByText('Tag created')).toBeVisible();
    const row = page.getByRole('row', {name: new RegExp(tagName)});
    await expect(row).toBeVisible();
    await expect(row.getByText('#3b82f6', {exact: false})).toBeVisible();

    // Rename
    await row.locator('button:has(.pi-pencil)').click();
    const editDialog = page.getByRole('dialog', {name: 'Edit Tag'});
    await expect(editDialog.locator('#tag-name')).toHaveValue(tagName);
    await editDialog.locator('#tag-name').fill(renamedTagName);
    await editDialog.getByRole('button', {name: 'Save Changes'}).click();

    await expect(page.getByText('Tag updated')).toBeVisible();
    const renamedRow = page.getByRole('row', {name: new RegExp(renamedTagName)});
    await expect(renamedRow).toBeVisible();

    // Delete, with confirmation
    await renamedRow.locator('button:has(.pi-trash)').click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog.getByText('removes it from any transactions currently tagged with it')).toBeVisible();
    await confirmDialog.getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Tag deleted.')).toBeVisible();
    await expect(page.getByRole('row', {name: new RegExp(renamedTagName)})).not.toBeVisible();
  });
});
