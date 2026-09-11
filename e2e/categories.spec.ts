import {expect, test} from '@playwright/test';

/**
 * Covers PF-332: category CRUD through the real UI (category-form-drawer), including the
 * parent/subcategory hierarchy -- create a parent, create a child under it, confirm it renders
 * nested once expanded, then edit the child's name.
 */
test.describe('Categories', () => {
  test('create a parent and child category, verify hierarchy, and edit', async ({page}) => {
    const parentName = `E2E Category Parent ${Date.now()}`;
    const childName = `E2E Category Child ${Date.now()}`;
    const renamedChildName = `${childName} Renamed`;

    await page.goto('/categories');

    // Create parent category
    await page.getByRole('button', {name: 'New Category'}).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: 'Create Category'})).toBeVisible();

    await drawer.locator('#name').fill(parentName);
    await drawer.locator('#color-picker button').first().click();
    await drawer.locator('#icon-picker button').first().click();
    await drawer.getByRole('button', {name: 'Create Category'}).click();

    await expect(page.getByText('Category created successfully')).toBeVisible();
    await expect(drawer).toBeHidden();

    const parentRow = page.getByRole('row', {name: new RegExp(parentName)});
    await expect(parentRow).toBeVisible();
    await expect(parentRow.getByText('EXPENSE')).toBeVisible();

    // Create child category, nested under the parent just created
    await page.getByRole('button', {name: 'New Category'}).click();
    await expect(drawer.getByRole('heading', {name: 'Create Category'})).toBeVisible();

    await drawer.locator('#name').fill(childName);
    await drawer.getByText('None (Top Level)').click();
    await page.getByRole('option', {name: parentName}).click();
    await drawer.getByRole('button', {name: 'Create Category'}).click();

    await expect(page.getByText('Category created successfully')).toBeVisible();

    // Hierarchy: the child is collapsed by default -- not visible until the parent expands
    await expect(page.getByText(childName)).not.toBeVisible();
    await page.getByRole('button', {name: 'Expand All'}).click();

    // PrimeNG's expanded-row wrapper <tr> (which contains the nested child table) also matches
    // this role/name query via its descendant text -- the actual child row is the innermost match.
    const childRow = page.getByRole('row', {name: new RegExp(childName)}).last();
    await expect(childRow).toBeVisible();
    await expect(childRow.getByText('EXPENSE')).toBeVisible();

    // Edit the child's name
    await childRow.locator('button:has(.pi-pencil)').click();
    const editDrawer = page.getByRole('complementary');
    await expect(editDrawer.getByRole('heading', {name: 'Edit Category'})).toBeVisible();
    await expect(editDrawer.locator('#name')).toHaveValue(childName);

    await editDrawer.locator('#name').fill(renamedChildName);
    await editDrawer.getByRole('button', {name: 'Update Category'}).click();

    await expect(page.getByText('Category updated successfully')).toBeVisible();
    await expect(page.getByRole('row', {name: new RegExp(renamedChildName)}).last()).toBeVisible();
  });
});
