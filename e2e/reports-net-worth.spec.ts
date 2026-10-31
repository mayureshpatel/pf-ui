import {expect, test} from './fixtures/test';
import {createTestAccount, createTestCategory, createTestTransaction, registerTestUser} from './helpers/api';

/**
 * Covers PF-887: the Reports net worth view through the real UI -- the four cards, what moved net
 * worth, the drill from an account type to an account and its story, the links into the explorer and
 * Accounts, and the state surviving a copied link. Uses a brand-new registered user so every total is
 * exact; read-only after seeding.
 */
test.describe('Reports net worth', () => {
  test.use({storageState: {cookies: [], origins: []}});

  test('cards, what moved it, drill to an account story, and both links', async ({page}) => {
    await registerTestUser(page);
    // createTestAccount seeds a $1,000 starting balance: 1,000 + 500 income - 100 - 50 = $1,350
    const account = await createTestAccount(page, 'E2E Net Worth Account');
    const parent = await createTestCategory(page, 'E2E Net Worth Parent');
    const category = await createTestCategory(page, 'E2E Net Worth Category', parent.id);
    const today = new Date().toISOString();
    await createTestTransaction(page, account.id, category.id, 'E2E Net Worth Salary', {
      amount: 500, type: 'INCOME', transactionDate: today
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Net Worth Lunch', {
      amount: 100, type: 'EXPENSE', transactionDate: today
    });
    await createTestTransaction(page, account.id, category.id, 'E2E Net Worth Coffee', {
      amount: 50, type: 'EXPENSE', transactionDate: today
    });

    // cards and what moved it
    await page.goto('/reports?view=networth');
    await expect(page.getByTestId('card-net-worth-value')).toHaveText('$1,350');
    await expect(page.getByTestId('card-assets-value')).toHaveText('$1,350');
    await expect(page.getByTestId('card-debts-value')).toHaveText('$0');
    await expect(page.getByText('Total change')).toBeVisible();

    // drill: account type, then the account and its story
    await page.getByRole('button', {name: /^Checking/}).click();
    await expect(page.getByText('Account type: Checking')).toBeVisible();
    await page.getByRole('button', {name: new RegExp(`^${account.name}`)}).click();
    await expect(page.getByRole('button', {name: 'Open in Accounts'})).toBeVisible();
    await expect(page.getByText('Deposits')).toBeVisible();

    // the drilled state survives a copied link
    const drilledUrl = page.url();
    await page.goto(drilledUrl);
    await expect(page.getByRole('button', {name: 'Open in Accounts'})).toBeVisible();

    // the explorer, filtered to this account
    await page.getByRole('button', {name: "Open this account's transactions in the explorer"}).click();
    await expect(page).toHaveURL(/\/reports\?.*accountIds=\d+/);
    await expect(page.getByRole('button', {name: 'Explorer'})).toHaveAttribute('aria-pressed', 'true');

    // Accounts, at this account
    await page.goto(drilledUrl);
    await page.getByRole('button', {name: 'Open in Accounts'}).click();
    await expect(page).toHaveURL(new RegExp(`/accounts\\?accountId=${account.id}`));
    await expect(page.getByRole('complementary')).toHaveAccessibleName(account.name);
  });
});
