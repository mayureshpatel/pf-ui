import {expect, test} from './fixtures/test';
import {trackByName} from './helpers/cleanup';

/**
 * Covers PF-882: the Merchants page through the real UI -- the list beside an always-present panel
 * (overview, merchant, add, description picker). Creates a throwaway merchant, links one real
 * transaction description that is not linked to anything yet (so no existing link is moved), removes
 * the link and deletes the merchant, leaving the user's data as it found it. Uses the shared dev
 * user's cached session (registration is limited to 5 per minute per IP). Skips when the user has no
 * unlinked descriptions to link.
 */
test.describe('Merchants', () => {
  test('create a merchant, link a description from the picker, then remove the link and delete it', async ({page}) => {
    const name = `E2E Merchant ${Date.now()}`;

    await page.goto('/merchants');
    const panel = page.getByRole('complementary');
    await expect(panel).toHaveAccessibleName('Overview');

    // Create the merchant through the panel; saving opens the picker for it
    await page.getByRole('button', {name: 'Add merchant'}).first().click();
    await expect(panel).toHaveAccessibleName('Add merchant');
    await panel.getByLabel('Name').fill(name);
    await panel.getByRole('button', {name: 'Add merchant'}).click();
    await expect(page.getByText('Merchant added')).toBeVisible();
    await trackByName(page, 'merchant', name);
    await expect(panel).toHaveAccessibleName('Link descriptions');

    // The picker starts on unlinked descriptions; take the first one
    await expect(panel.getByRole('button', {name: 'Unlinked only'})).toHaveAttribute('aria-pressed', 'true');
    const firstCheckbox = panel.getByRole('checkbox').first();
    const hasDescriptions = await firstCheckbox.waitFor({timeout: 5000}).then(() => true, () => false);
    if (!hasDescriptions) {
      await panel.getByRole('button', {name: `Back to ${name}`}).click();
      await panel.getByRole('button', {name: 'Delete merchant'}).click();
      await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();
      await expect(page.getByText('Merchant deleted')).toBeVisible();
      test.skip(true, 'The user has no unlinked transaction descriptions to link');
    }
    const description = ((await firstCheckbox.getAttribute('aria-label')) ?? '').replace(/^Select /, '');
    await firstCheckbox.check();
    await panel.getByRole('button', {name: 'Link 1 description'}).click();
    await expect(page.getByText('Linked 1 description')).toBeVisible();

    // Back on the merchant: the description is listed, and the list shows the link count
    await expect(panel).toHaveAccessibleName(name);
    await expect(panel.getByTestId('linked-description')).toContainText(description);
    await page.getByLabel('Search merchants').fill(name);
    const row = page.getByTestId('open-merchant').filter({hasText: name});
    await expect(row).toContainText('1 link');

    // Remove the link, then delete the merchant
    await panel.getByRole('button', {name: `Remove link to ${description}`}).click();
    await expect(page.getByText('Link removed')).toBeVisible();
    await expect(panel.getByText('No descriptions linked yet.')).toBeVisible();
    await panel.getByRole('button', {name: 'Delete merchant'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Delete', exact: true}).click();

    await expect(page.getByText('Merchant deleted')).toBeVisible();
    await expect(page.getByTestId('open-merchant').filter({hasText: name})).toHaveCount(0);
    await expect(panel).toHaveAccessibleName('Overview');
  });
});
