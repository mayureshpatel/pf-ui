import {expect, test} from '@playwright/test';
import {
  createTestAccount,
  createTestMerchant,
  createTestTransactionExact,
  deleteTestMerchant
} from './helpers/api';

/**
 * Covers PF-884: the Recurring page through the real UI -- the grouped list beside an always-present
 * panel (overview, item, add, review). Uses the shared dev user's cached session (registration is
 * limited to 5 per minute per IP) and creates and removes only its own data: a throwaway account,
 * merchants and recurring items; the seeded transactions of the review test stay behind like every
 * other spec's seed data.
 */
test.describe('Recurring', () => {
  test('add an item by hand, pause and resume it, then delete it', async ({page}) => {
    await page.goto('/recurring');
    const account = await createTestAccount(page, 'E2E Recurring Account');
    const merchant = await createTestMerchant(page, 'E2E Recurring Merchant');

    try {
      await page.reload();
      const panel = page.getByRole('complementary');
      await expect(panel).toHaveAccessibleName('Overview');

      // Add through the panel
      await page.getByRole('button', {name: 'Add recurring'}).first().click();
      await expect(panel).toHaveAccessibleName('Add recurring');
      await panel.getByText('Choose a merchant').click();
      // the list shows the first merchants only; the filter searches them all
      await page.locator('.p-select-filter').fill(merchant.name);
      await page.getByRole('option', {name: merchant.name}).click();
      await panel.getByText('Choose an account').click();
      await page.getByRole('option', {name: account.name}).click();
      await panel.getByRole('combobox', {name: 'Frequency'}).click();
      await page.getByRole('option', {name: 'Weekly', exact: true}).click();
      await panel.getByRole('spinbutton').fill('55');
      // p-datepicker does not commit a typed value; use its calendar: next month, day 1
      await panel.locator('#recurring-next-date').click();
      await page.getByRole('button', {name: 'Next Month'}).click();
      await page.locator('td.p-datepicker-day-cell:not(.p-datepicker-other-month)').getByText('1', {exact: true}).click();
      await panel.getByRole('button', {name: 'Add recurring'}).click();

      await expect(page.getByText('Recurring item added')).toBeVisible();
      await expect(panel).toHaveAccessibleName(merchant.name);
      const row = page.getByTestId('open-item').filter({hasText: merchant.name});
      await expect(row).toContainText('$55.00');
      await expect(page.getByTestId('group-header').filter({hasText: 'Weekly'})).toBeVisible();

      // Pause moves it to Paused, Resume brings it back
      await panel.getByRole('button', {name: 'Pause'}).click();
      await expect(page.getByText('Paused', {exact: true}).first()).toBeVisible();
      await expect(row).toContainText('Paused');
      await panel.getByRole('button', {name: 'Resume'}).click();
      await expect(page.getByText('Resumed')).toBeVisible();
      await expect(row).not.toContainText('Paused');

      // Delete
      await panel.getByRole('button', {name: 'Delete'}).click();
      await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();
      await expect(page.getByText('Recurring item deleted')).toBeVisible();
      await expect(page.getByTestId('open-item').filter({hasText: merchant.name})).toHaveCount(0);
      await expect(panel).toHaveAccessibleName('Overview');
    } finally {
      await deleteTestMerchant(page, merchant.id);
    }
  });

  test('review a detected pattern, add it, then remove the item and its merchant', async ({page}) => {
    await page.goto('/recurring');
    const account = await createTestAccount(page, 'E2E Pattern Account');
    const patternName = `E2E PATTERN ${Date.now()}`;
    const now = new Date();
    // three monthly charges on the 15th, the latest about a month ago: a stable monthly pattern
    for (let monthsAgo = 3; monthsAgo >= 1; monthsAgo--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 15)).toISOString();
      await createTestTransactionExact(page, account.id, patternName, {amount: 75, transactionDate: date});
    }

    await page.reload();
    const panel = page.getByRole('complementary');
    await expect(page.getByTestId('patterns-strip')).toBeVisible();
    await page.getByTestId('patterns-strip').getByRole('button', {name: 'Review'}).click();
    await expect(panel).toHaveAccessibleName('Patterns found');

    await panel.getByTestId('pattern-row').filter({hasText: patternName}).click();
    await expect(panel).toHaveAccessibleName(patternName);
    // the detected text is turned into a new merchant, named by the user; keep it unique and cleanable
    const merchantName = `E2E Pattern Merchant ${Date.now()}`;
    await panel.getByLabel('New merchant name').fill(merchantName);
    await panel.getByRole('button', {name: 'Add to recurring'}).click();

    await expect(page.getByText('Added to recurring')).toBeVisible();
    const row = page.getByTestId('open-item').filter({hasText: merchantName});
    await expect(row).toContainText('$75.00');
    await expect(page.getByTestId('group-header').filter({hasText: 'Monthly'})).toBeVisible();

    // Clean up: delete the item, then the merchant it created (its description link goes with it)
    await row.click();
    await panel.getByRole('button', {name: 'Delete'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();
    await expect(page.getByText('Recurring item deleted')).toBeVisible();

    await page.goto('/merchants');
    await page.getByLabel('Search merchants').fill(merchantName);
    await page.getByTestId('open-merchant').filter({hasText: merchantName}).click();
    await page.getByRole('complementary').getByRole('button', {name: 'Delete merchant'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();
    await expect(page.getByText('Merchant deleted')).toBeVisible();
  });
});
