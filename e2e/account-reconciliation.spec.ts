import {expect, test} from '@playwright/test';
import {createTestAccount} from './helpers/api';

/**
 * "Verify locked state" from the original ticket is excluded: there's no locking concept
 * anywhere in the schema or backend (confirmed by grepping every migration). Reconciling just
 * creates a balance-adjustment transaction if the stated balance differs -- verified below.
 */
test.describe('Account Reconciliation', () => {
  test('each row has a named actions menu offering the four shortcuts (PF-186)', async ({page}) => {
    await page.goto('/accounts');
    const account = await createTestAccount(page, 'E2E Accessible Name');

    await page.reload();
    await page.getByRole('button', {name: `Actions for ${account.name}`}).click();

    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', {name: 'View transactions'})).toBeVisible();
    await expect(menu.getByRole('menuitem', {name: 'Reconcile'})).toBeVisible();
    await expect(menu.getByRole('menuitem', {name: 'Edit'})).toBeVisible();
    await expect(menu.getByRole('menuitem', {name: 'Delete'})).toBeVisible();
  });

  test('the overview is the default and a row opens its account and back', async ({page}) => {
    await page.goto('/accounts');
    const account = await createTestAccount(page, 'E2E Overview');

    await page.reload();
    const panel = page.getByRole('complementary');
    await expect(panel).toHaveAccessibleName('Overview');
    await expect(panel.getByTestId('net-worth')).toBeVisible();

    await page.getByTestId('open-account').filter({hasText: account.name}).click();
    await expect(panel).toHaveAccessibleName(account.name);

    await panel.getByRole('button', {name: 'Back to overview'}).click();
    await expect(panel).toHaveAccessibleName('Overview');
  });

  test('reconciling to a different balance updates the account via an adjustment transaction', async ({page}) => {
    await page.goto('/accounts');
    const account = await createTestAccount(page, 'E2E Reconcile');

    await page.reload();
    const row = page.getByTestId('open-account').filter({hasText: account.name});
    // The row menu's Reconcile opens the panel straight on the reconcile step.
    await page.getByRole('button', {name: `Actions for ${account.name}`}).click();
    await page.getByRole('menuitem', {name: 'Reconcile'}).click();

    // The docked side panel is an <aside> (role="complementary") labelled with its title.
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: `Reconcile ${account.name}`})).toBeVisible();
    await expect(drawer.getByText('$1,000.00')).toBeVisible();

    // id="targetBalance" lands on the <p-inputnumber> host element, not the inner native
    // <input> -- target the real input by its role instead.
    await drawer.getByRole('spinbutton').pressSequentially('1200', {delay: 30});

    // Wait for the reactively-computed adjustment preview to settle before clicking --
    // otherwise the click can race the re-render it triggers on every keystroke.
    await expect(drawer.getByText('+$200.00')).toBeVisible();
    await drawer.getByRole('button', {name: 'Reconcile', exact: true}).click();

    await expect(page.getByText('Account reconciled successfully')).toBeVisible();
    // The panel returns to the account's summary with the new balance.
    await expect(drawer.getByTestId('balance')).toContainText('$1,200.00');
    await expect(row).toContainText('$1,200.00');
  });

  test('reconciling to the same balance creates no adjustment', async ({page}) => {
    await page.goto('/accounts');
    const account = await createTestAccount(page, 'E2E Reconcile Balanced');

    await page.reload();
    // The row menu's Reconcile opens the panel straight on the reconcile step.
    await page.getByRole('button', {name: `Actions for ${account.name}`}).click();
    await page.getByRole('menuitem', {name: 'Reconcile'}).click();

    // The docked side panel is an <aside> (role="complementary") labelled with its title.
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: `Reconcile ${account.name}`})).toBeVisible();
    // id="targetBalance" lands on the <p-inputnumber> host element, not the inner native
    // <input> -- target the real input by its role instead.
    await drawer.getByRole('spinbutton').pressSequentially('1000', {delay: 30});

    await expect(drawer.getByText('Balanced. Nothing to adjust.')).toBeVisible();
    await expect(drawer.getByText(/This posts a balance adjustment/)).not.toBeVisible();
  });
});
