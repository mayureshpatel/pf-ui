import type {Locator, Page} from '@playwright/test';
import {expect, test} from './fixtures/test';
import {
  createTestAccount,
  createTestMerchant,
  createTestMerchantRule,
  createTestTransactionExact,
  getAuthToken
} from './helpers/api';
import {trackMerchantRuleByKeyword} from './helpers/cleanup';

/**
 * Covers PF-984: after a group is linked in the Unlinked tab, a card offers a rule with the group
 * key as its keyword, previews where it meets another merchant, and creates it only on
 * confirmation; a group a rule already covers gets no offer. Seeds its own account, merchants and
 * transactions whose descriptions carry a unique letters-only tag (a digit would end the group
 * key), so the groups and previews only ever see this test's data. The cleanup fixture deletes all
 * of it, and the rule made through the UI, afterwards.
 */

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';

/** A letters-only tag unique to this test; the random part keeps parallel workers apart. */
const runTag = (): string => {
  const letters = (text: string): string => text.replace(/[0-9]/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
  const random = Array.from({length: 4}, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  return `R${letters(Date.now().toString(36))}${random}`.toUpperCase();
};

interface Seed {
  tag: string;
  /** the store group's key, which the offer uses as its keyword */
  storeKey: string;
  kroger: {id: number; name: string};
  fuelCenter: {id: number; name: string};
}

async function seed(page: Page): Promise<Seed> {
  const tag = runTag();
  const word = tag.charAt(0) + tag.slice(1).toLowerCase();
  const account = await createTestAccount(page, `E2E Rule offer ${tag}`);
  const today = new Date().toISOString().split('T')[0];
  for (const description of [
    `KROGER ${tag} #431`,
    `KROGER ${tag} #12`,
    `KROGER ${tag} FUEL CTR #1`,
    `KROGER ${tag} FUEL CTR #2`
  ]) {
    await createTestTransactionExact(page, account.id, description, {
      amount: 25,
      transactionDate: `${today}T00:00:00Z`
    });
  }
  const kroger = await createTestMerchant(page, `Kroger ${word}`);
  const fuelCenter = await createTestMerchant(page, `Kroger ${word} Fuel Center`);
  return {tag, storeKey: `kroger ${tag.toLowerCase()}`, kroger, fuelCenter};
}

/** Opens the Unlinked tab on this test's groups and returns the store group's row. */
async function openStoreGroup(page: Page, tag: string): Promise<{rows: Locator; store: Locator}> {
  await page.goto('/merchants?view=unlinked');
  await page.getByLabel('Search unlinked descriptions').fill(tag);
  const rows = page.getByTestId('group-row');
  await expect(rows).toHaveCount(2);
  return {rows, store: rows.filter({hasNotText: 'FUEL'})};
}

/** Picks a merchant in a row's field once its debounced search has answered. */
async function choose(page: Page, row: Locator, merchantName: string): Promise<void> {
  const searched = page.waitForResponse(
    (r) => r.request().method() === 'GET' && new URL(r.url()).searchParams.get('search') === merchantName
  );
  await row.getByRole('combobox').fill(merchantName);
  await searched;
  await row.getByRole('option', {name: merchantName, exact: true}).click();
}

test.describe('Merchants rule offer', () => {
  test('offers a rule after a link, names the overlap, and creates it once edited and confirmed', async ({page}) => {
    const {tag, storeKey, kroger, fuelCenter} = await seed(page);
    // the fuel center's longer keyword wins the fuel descriptions the store keyword also matches
    await createTestMerchantRule(page, fuelCenter.id, `${storeKey} fuel`, 0);
    const {rows, store} = await openStoreGroup(page, tag);

    await choose(page, store, kroger.name);
    const status = page.locator('app-unlinked-groups').getByTestId('link-result-announcement');
    await expect(status).toHaveText(`Linked 2 to ${kroger.name} · 2 transactions filled`);
    await expect(rows).toHaveCount(1);

    // The offer stands where the group was, with focus, and nothing is created yet
    const offer = page.getByTestId('rule-offer');
    await expect(offer).toBeFocused();
    await expect(offer.getByTestId('rule-offer-keywords')).toHaveText(`\`${storeKey}\``);
    await expect(offer).toContainText(`→ ${kroger.name}`);
    await expect(offer.getByTestId('rule-offer-matches')).toHaveText(
      'Matches 4 transactions; would fill no blank ones.'
    );
    await expect(offer.getByTestId('rule-offer-overlap')).toHaveText(
      `${fuelCenter.name} wins on 2 descriptions: longer keywords`
    );

    // Editing the priority makes the store rule win the fuel descriptions instead
    await offer.getByTestId('rule-offer-edit').click();
    await expect(offer.getByLabel('Keywords')).toBeFocused();
    const priority = offer.getByLabel('Priority');
    await priority.fill('5');
    await priority.blur();
    await expect(offer.getByTestId('rule-offer-overlap')).toHaveText(
      `This rule takes 2 descriptions from ${fuelCenter.name}: higher priority`
    );
    await expect(offer.getByTestId('rule-offer-matches')).toHaveText(
      'Matches 4 transactions; would fill 2 blank ones.'
    );
    await priority.fill('0');
    await priority.blur();
    await expect(offer.getByTestId('rule-offer-overlap')).toHaveText(
      `${fuelCenter.name} wins on 2 descriptions: longer keywords`
    );

    // Enter in a field creates the rule; the card closes and focus moves on to the next group
    await offer.getByLabel('Keywords').press('Enter');
    await trackMerchantRuleByKeyword(page, storeKey);
    await expect(page.getByText('Rule created')).toBeVisible();
    await expect(offer).toHaveCount(0);
    await expect(rows.first().getByRole('group')).toBeFocused();
  });

  test('says a rule already covers the group, and Escape skips an offer without creating one', async ({page}) => {
    const {tag, storeKey, kroger, fuelCenter} = await seed(page);
    await createTestMerchantRule(page, kroger.id, storeKey, 0);
    await createTestMerchantRule(page, fuelCenter.id, `${storeKey} fuel`, 0);
    const {rows, store} = await openStoreGroup(page, tag);

    // Kroger's own rule already wins both store descriptions
    await choose(page, store, kroger.name);
    const offer = page.getByTestId('rule-offer');
    await expect(offer.getByTestId('rule-offer-covered')).toHaveText('A rule already covers this');
    await expect(offer).toContainText(`\`${storeKey}\` → ${kroger.name}`);
    await expect(offer.getByTestId('rule-offer-create')).toHaveCount(0);
    await offer.getByTestId('rule-offer-ok').click();
    await expect(offer).toHaveCount(0);

    // The fuel group linked to Kroger is not covered (the fuel center's rule ranks first): Escape skips
    const fuel = rows.filter({hasText: 'FUEL'});
    await choose(page, fuel, kroger.name);
    const guard = fuel.getByTestId('link-guard');
    await guard.getByRole('button', {name: 'Link anyway'}).click();
    await expect(offer).toBeFocused();
    await expect(offer.getByTestId('rule-offer-create')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(offer).toHaveCount(0);
    // Kroger still has only the rule seeded above
    const response = await page.request.get(`${API_URL}/merchant-rules?merchantId=${kroger.id}`, {
      headers: {Authorization: `Bearer ${await getAuthToken(page)}`}
    });
    expect(response.ok()).toBe(true);
    expect(((await response.json()) as unknown[]).length).toBe(1);
  });
});
