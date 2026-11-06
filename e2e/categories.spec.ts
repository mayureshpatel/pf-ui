import {expect, test} from './fixtures/test';
import {deleteTestCategoriesContaining, registerTestUser} from './helpers/api';

/**
 * Covers PF-332/PF-878: category CRUD through the real UI -- the tree beside an always-present
 * panel (overview, category, add, selection), the parent/subcategory hierarchy, the search and
 * Unused filters, and the tick-and-delete cleanup. Uses the shared dev user's cached session (not a
 * new registration: registration is limited to 5 per minute per IP) and creates and removes only
 * its own categories, never budgeting them.
 */
test.describe('Categories', () => {
  let stamp = 0;

  // The UI cleanup at the end of the test is part of what it checks, but a step failing midway would
  // leave the categories behind on the shared dev user, so remove whatever is left through the API.
  test.afterEach(async ({page}) => {
    if (stamp) await deleteTestCategoriesContaining(page, String(stamp));
  });

  test('create a parent and child, edit the child, then tick and delete both as unused', async ({page}) => {
    stamp = Date.now();
    const parentName = `E2E Category Parent ${stamp}`;
    const childName = `E2E Category Child ${stamp}`;
    const renamedChildName = `${childName} Renamed`;

    await page.goto('/categories');
    const panel = page.getByRole('complementary');
    await expect(panel).toHaveAccessibleName('Overview');

    // Create the parent through the panel
    await page.getByRole('button', {name: 'Add category'}).first().click();
    await expect(panel).toHaveAccessibleName('Add category');
    await panel.getByLabel('Name').fill(parentName);
    await panel.getByRole('button', {name: 'Add category'}).click();
    await expect(page.getByText('Category added')).toBeVisible();
    await expect(panel).toHaveAccessibleName(parentName);
    // let this toast go before the next create, or the next wait would match it instead of its own
    await expect(page.getByText('Category added')).toBeHidden();

    // Create the child under it (wait for the panel to switch: the old category form also has a Name field)
    await page.getByRole('button', {name: 'Add category'}).first().click();
    await expect(panel).toHaveAccessibleName('Add category');
    await panel.getByLabel('Name').fill(childName);
    await panel.getByText('No parent').click();
    await page.getByRole('option', {name: parentName}).click();
    await panel.getByRole('button', {name: 'Add category'}).click();
    await expect(page.getByText('Category added')).toBeVisible();
    await expect(panel).toHaveAccessibleName(childName);

    // Find both with the search box; filtering shows the child under its parent
    await page.getByLabel('Search categories').fill(String(stamp));
    await expect(page.getByTestId('open-category').filter({hasText: parentName})).toBeVisible();
    const childRow = page.getByTestId('open-category').filter({hasText: childName});
    await expect(childRow).toBeVisible();

    // Edit the child's name in place
    await childRow.click();
    await expect(panel).toHaveAccessibleName(childName);
    await panel.getByLabel('Name').fill(renamedChildName);
    await panel.getByRole('button', {name: 'Save changes'}).click();
    await expect(page.getByText('Category updated')).toBeVisible();
    await expect(page.getByTestId('open-category').filter({hasText: renamedChildName})).toBeVisible();

    // Clean up through the Unused pill: tick the child, then its parent, and delete them together
    await page.getByRole('button', {name: /^Unused/}).click();
    await page.getByLabel(`Select ${renamedChildName}`).check();
    await page.getByLabel(`Select ${parentName}`).check();
    await expect(panel).toHaveAccessibleName('2 selected');
    await panel.getByRole('button', {name: 'Delete 2 categories'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Deleted 2 categories')).toBeVisible();
    await expect(page.getByTestId('open-category').filter({hasText: String(stamp)})).toHaveCount(0);
    await expect(panel).toHaveAccessibleName('Overview');
  });

  test('add a parent with subcategories in one go, then see a repeat reported as skipped', async ({page}) => {
    stamp = Date.now();
    const parentName = `E2E Bulk Parent ${stamp}`;
    const subs = [`E2E Bulk Sub A ${stamp}`, `E2E Bulk Sub B ${stamp}`, `E2E Bulk Sub C ${stamp}`];
    // the afterEach above removes every category whose name holds the stamp, children first, even if a step fails

    await page.goto('/categories');
    const panel = page.getByRole('complementary');
    const fillAndCreate = async () => {
      await page.getByRole('button', {name: 'Add several'}).click();
      await expect(panel).toHaveAccessibleName('Add several categories');
      await panel.getByLabel('Parent name').fill(parentName);
      await panel.getByLabel('Subcategories').fill(subs.join('\n'));
      await panel.getByRole('button', {name: 'Create', exact: true}).click();
    };

    await fillAndCreate();
    await expect(page.getByText('Created 4 categories (1 parent, 3 subcategories)')).toBeVisible();
    await expect(panel).toHaveAccessibleName('Overview');

    // find the parent and its subcategories with the search box
    await page.getByLabel('Search categories').fill(String(stamp));
    await expect(page.getByTestId('open-category').filter({hasText: parentName})).toBeVisible();
    for (const sub of subs) {
      await expect(page.getByTestId('open-category').filter({hasText: sub})).toBeVisible();
    }

    // adding the same group again creates nothing and lists every name as skipped
    await fillAndCreate();
    await expect(panel.getByTestId('bulk-result')).toBeVisible();
    await expect(panel.getByRole('heading', {name: 'Skipped (4)'})).toBeVisible();
    await panel.getByTestId('bulk-done').click();
    await expect(panel).toHaveAccessibleName('Overview');
  });

  test('add a starter set to an empty account, leaving one parent unticked', async ({page}) => {
    // a freshly registered user has no categories, and there is nothing of the shared user's to clean up
    stamp = 0;
    await registerTestUser(page);
    await page.goto('/categories');
    const panel = page.getByRole('complementary');

    await page.getByTestId('add-starter').click();
    await expect(panel).toHaveAccessibleName('Add a starter set');
    // 14 parents and 55 subcategories, all ticked
    await expect(panel.getByTestId('starter-count')).toHaveText('69 categories selected');

    // unticking Taxes unticks its 3 subcategories too
    await panel.getByRole('checkbox', {name: /^Taxes/}).uncheck();
    await expect(panel.getByTestId('starter-count')).toHaveText('65 categories selected');

    await panel.getByRole('button', {name: 'Add selected'}).click();
    await expect(page.getByText('Created 65 categories (13 parents, 52 subcategories)')).toBeVisible();
    await expect(panel).toHaveAccessibleName('Overview');

    const rows = page.getByTestId('open-category');
    await expect(rows.getByText('Housing', {exact: true})).toHaveCount(1);
    await expect(rows.getByText('Transfers', {exact: true})).toHaveCount(1);
    await expect(rows.getByText('Taxes', {exact: true})).toHaveCount(0);
    // the starter offer is gone once the account has categories
    await expect(page.getByTestId('add-starter')).toHaveCount(0);
  });
});
