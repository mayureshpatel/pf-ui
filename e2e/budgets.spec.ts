import {expect, test} from '@playwright/test';
import {
  createTestAccount,
  createTestBudget,
  createTestCategory,
  createTestTransaction,
  registerTestUser
} from './helpers/api';

/**
 * Covers PF-333/PF-875: the redesigned Budgets page through the real UI -- a category list beside an
 * always-present panel (overview, category, add), a month switcher kept in the URL, edit and remove
 * in place, and Copy last month. Uses a brand-new registered user so spent/left amounts are exact
 * (the shared dev user's accumulated transactions would make specific totals fragile). Budgets
 * default to the current month, so seeded transactions are dated "today" (in UTC).
 */
test.describe('Budgets', () => {
  test.use({storageState: {cookies: [], origins: []}});

  async function seedCategoryWithSpending(page: import('@playwright/test').Page) {
    // Budgeting allows a parent or a subcategory, but transactions can only be assigned to a
    // subcategory -- budget and transact against the same subcategory to keep this simple.
    const parentCategory = await createTestCategory(page, 'E2E Budget Parent');
    const category = await createTestCategory(page, 'E2E Budget Category', parentCategory.id);
    const account = await createTestAccount(page, 'E2E Budget Account');
    const now = new Date();
    const currentMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)).toISOString();
    await createTestTransaction(page, account.id, category.id, 'E2E Budget Expense', {
      amount: 120, type: 'EXPENSE', transactionDate: currentMonthDate
    });
    return category;
  }

  test('set a budget, then edit its limit and remove it', async ({page}) => {
    await registerTestUser(page);
    const category = await seedCategoryWithSpending(page);

    await page.goto('/budgets');
    const panel = page.getByRole('complementary');
    await expect(panel).toHaveAccessibleName('Overview');

    // Add through the panel
    await page.getByRole('button', {name: 'Add budget'}).first().click();
    await expect(panel).toHaveAccessibleName('Add budget');
    await panel.getByText('Select a category').click();
    await page.getByRole('option', {name: category.name}).click();
    await panel.getByRole('spinbutton').fill('300');
    await panel.getByRole('button', {name: 'Add budget'}).click();

    await expect(page.getByText('Budget added')).toBeVisible();
    const row = page.getByTestId('open-budget').filter({hasText: category.name});
    await expect(row).toContainText('$120.00 of $300.00');
    await expect(row).toContainText('$180.00 left');
    await expect(panel).toHaveAccessibleName(category.name);

    // Back to the month overview
    await panel.getByRole('button', {name: 'Back to overview'}).click();
    await expect(panel).toHaveAccessibleName('Overview');
    await expect(panel.getByTestId('left-to-spend')).toContainText('$180.00');

    // Edit the limit in place
    await row.click();
    await panel.getByRole('spinbutton').fill('400');
    await panel.getByRole('button', {name: 'Save limit'}).click();
    await expect(page.getByText('Budget updated')).toBeVisible();
    await expect(row).toContainText('$280.00 left');

    // Remove it
    await panel.getByRole('button', {name: 'Remove budget'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Remove', exact: true}).click();
    await expect(page.getByText('Budget removed')).toBeVisible();
    // the spending is still there, now with no limit
    await expect(row).toContainText('$120.00 spent');
    await expect(row).toContainText('No limit');
    await expect(panel).toHaveAccessibleName('Overview');
  });

  test('copy last month fills the gaps in this month', async ({page}) => {
    await registerTestUser(page);
    const category = await seedCategoryWithSpending(page);
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    await createTestBudget(page, category.id, 250, last.getMonth() + 1, last.getFullYear());

    await page.goto('/budgets');
    await expect(page.getByText(/No budgets for/)).toBeVisible();

    await page.getByRole('button', {name: "Copy last month's limits"}).click();
    await page.getByRole('button', {name: 'Fill gaps'}).click();

    await expect(page.getByText('Added 1 limit')).toBeVisible();
    const row = page.getByTestId('open-budget').filter({hasText: category.name});
    await expect(row).toContainText('$120.00 of $250.00');
  });
});

/**
 * PF-819: counts network requests only, so it uses the shared dev user's cached session instead of
 * registering another user (registration is limited to 5 per minute per IP, and the suite already
 * registers several).
 */
test.describe('Budgets month switcher', () => {
  test('changing month fires one status request and updates the URL (PF-819)', async ({page}) => {
    const statusRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/budgets/status')) statusRequests.push(req.url());
    });

    await page.goto('/budgets');
    await expect(page.getByTestId('month-label')).toBeVisible();
    await page.waitForLoadState('networkidle');
    statusRequests.length = 0; // clear whatever the initial page load itself triggered

    // act -- one real click on Next month
    await page.getByRole('button', {name: 'Next month'}).click();
    await page.waitForLoadState('networkidle');

    // assert & verify
    expect(statusRequests).toHaveLength(1);
    await expect(page).toHaveURL(/month=\d+&year=\d+/);
    await expect(page.getByRole('button', {name: 'This month'})).toBeVisible();

    await page.getByRole('button', {name: 'This month'}).click();
    await expect(page.getByRole('button', {name: 'This month'})).toHaveCount(0);
  });
});
