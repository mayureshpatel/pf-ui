import type {Page} from '@playwright/test';
import {expect, test} from './fixtures/test';
import {createTestAccount, createTestMerchant, createTestTransactionExact} from './helpers/api';

/**
 * Covers PF-983: the look-alike guard, Select group, exclude-term search and the status line with
 * Undo, through the real UI on the Kroger / Kroger Fuel Center case. Seeds its own account, two
 * merchants and four transactions whose descriptions carry a unique letters-only tag (a digit would
 * end the group key), so the groups and the guard only ever see this test's data. The cleanup
 * fixture deletes all of it afterwards.
 */

/**
 * A letters-only tag unique to this test, e.g. "KZQBCDEXRT". The random part keeps tests started in
 * the same millisecond by parallel workers apart.
 */
const runTag = (): string => {
  const letters = (text: string): string => text.replace(/[0-9]/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
  const random = Array.from({length: 4}, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  return `K${letters(Date.now().toString(36))}${random}`.toUpperCase();
};

interface Seed {
  tag: string;
  kroger: {id: number; name: string};
  fuelCenter: {id: number; name: string};
}

async function seed(page: Page): Promise<Seed> {
  const tag = runTag();
  const word = tag.charAt(0) + tag.slice(1).toLowerCase();
  const account = await createTestAccount(page, `E2E Look-alike ${tag}`);
  const today = new Date().toISOString().split('T')[0];
  for (const description of [
    `KROGER ${tag} #431`,
    `KROGER ${tag} #12`,
    `KROGER ${tag} FUEL CTR #1`,
    `KROGER ${tag} FUEL CTR #2`,
  ]) {
    await createTestTransactionExact(page, account.id, description, {
      amount: 25,
      transactionDate: `${today}T00:00:00Z`,
    });
  }
  const kroger = await createTestMerchant(page, `Kroger ${word}`);
  const fuelCenter = await createTestMerchant(page, `Kroger ${word} Fuel Center`);
  return {tag, kroger, fuelCenter};
}

test.describe('Merchants look-alike guard', () => {
  test('the picker flags the fuel descriptions, leaves them out, and undoes the link', async ({page}) => {
    const {tag, kroger, fuelCenter} = await seed(page);

    await page.goto('/merchants');
    const panel = page.getByRole('complementary');
    await page.getByLabel('Search merchants').fill(kroger.name);
    await page.getByTestId('open-merchant').filter({hasText: kroger.name}).click();
    await expect(panel).toHaveAccessibleName(kroger.name);
    await panel.getByRole('button', {name: 'Link descriptions'}).click();
    await expect(panel).toHaveAccessibleName('Link descriptions');

    // Exclude terms: "-fuel" leaves the fuel group out
    const search = panel.getByLabel('Search descriptions');
    const groups = panel.getByTestId('picker-group');
    await search.fill(`${tag} -fuel`);
    await expect(groups).toHaveCount(1);
    await expect(groups.first()).not.toContainText('FUEL');
    await search.fill(tag);
    await expect(groups).toHaveCount(2);

    // Select group ticks every variant of both groups
    const store = groups.filter({hasNotText: 'FUEL'});
    const fuel = groups.filter({hasText: 'FUEL'});
    await store.getByTestId('select-group').check();
    await fuel.getByTestId('select-group').check();
    await expect(panel.getByTestId('description-row').getByRole('checkbox', {checked: true})).toHaveCount(4);

    // The guard names the words Kroger lacks and the merchant that has them
    await panel.getByRole('button', {name: 'Link 4 descriptions'}).click();
    const guard = panel.getByTestId('link-guard');
    // the user's own merchants may add more rivals (a real "Kroger Fuel Center"), so names are checked one by one
    await expect(guard).toContainText(`2 of these contain FUEL`);
    await expect(guard).toContainText(`which ${kroger.name} doesn't.`);
    await expect(guard).toContainText(fuelCenter.name);
    await expect(guard.getByRole('button', {name: 'Leave those out, link 2'})).toBeFocused();

    // Leave those out: only the store descriptions are linked; the status line has the counts
    await guard.getByRole('button', {name: 'Leave those out, link 2'}).click();
    await expect(panel).toHaveAccessibleName(kroger.name);
    const status = panel.getByTestId('link-result-announcement');
    await expect(status).toHaveText(`Linked 2 to ${kroger.name} · 2 transactions filled`);
    await expect(panel.getByTestId('linked-description')).toHaveCount(2);
    await expect(panel.getByTestId('linked-description').filter({hasText: 'FUEL'})).toHaveCount(0);

    // Undo takes the links back and the merchant's list with them
    await panel.getByTestId('link-result-undo').click();
    await expect(status).toHaveText('Link undone');
    await expect(panel.getByText('No descriptions linked yet.')).toBeVisible();
  });

  test('the Unlinked tab warns only for the look-alike group, then links it to the right merchant', async ({page}) => {
    const {tag, kroger, fuelCenter} = await seed(page);

    await page.goto('/merchants?view=unlinked');
    await page.getByLabel('Search unlinked descriptions').fill(tag);
    const rows = page.getByTestId('group-row');
    await expect(rows).toHaveCount(2);
    const store = rows.filter({hasNotText: 'FUEL'});
    const fuel = rows.filter({hasText: 'FUEL'});
    // the list re-sorts when the debounced search answers, so pick only once it has
    const choose = async (row: typeof store, merchantName: string): Promise<void> => {
      const searched = page.waitForResponse(
        (r) => r.request().method() === 'GET' && new URL(r.url()).searchParams.get('search') === merchantName,
      );
      await row.getByRole('combobox').fill(merchantName);
      await searched;
      await row.getByRole('option', {name: merchantName, exact: true}).click();
    };

    // The fuel group chosen for Kroger is held, and leaving it out links nothing
    await choose(fuel, kroger.name);
    const guard = fuel.getByTestId('link-guard');
    await expect(guard).toContainText(`All 2 of these contain FUEL`);
    await expect(guard).toContainText(fuelCenter.name);
    await guard.getByRole('button', {name: "Don't link these"}).click();
    await expect(guard).toHaveCount(0);
    await expect(rows).toHaveCount(2);

    // Every store description fits Kroger: no warning, straight to the status line
    const status = page.locator('app-unlinked-groups').getByTestId('link-result-announcement');
    await choose(store, kroger.name);
    await expect(status).toHaveText(`Linked 2 to ${kroger.name} · 2 transactions filled`);
    await expect(page.getByTestId('link-guard')).toHaveCount(0);
    await expect(rows).toHaveCount(1);

    // The fuel group fits Kroger Fuel Center, so it links without a warning; ticks come back first
    await fuel.getByRole('button', {name: /^Show descriptions for/}).click();
    // "Don't link these" left both fuel descriptions unticked; wait for them before ticking
    const fuelBoxes = fuel.getByTestId('variant-row').getByRole('checkbox');
    await expect(fuelBoxes).toHaveCount(2);
    for (const box of await fuelBoxes.all()) await box.check();
    await choose(fuel, fuelCenter.name);
    await expect(status).toHaveText(`Linked 2 to ${fuelCenter.name} · 2 transactions filled`);
    await expect(rows).toHaveCount(0);

    // Undo brings the fuel group back
    await page.getByTestId('link-result-undo').click();
    await expect(status).toHaveText('Link undone');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('FUEL');
  });
});
