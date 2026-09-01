import {expect, test} from '@playwright/test';
import {createTestAccount} from './helpers/api';

/**
 * "Verify locked state" from the original ticket is excluded: there's no locking concept
 * anywhere in the schema or backend (confirmed by grepping every migration). Reconciling just
 * creates a balance-adjustment transaction if the stated balance differs -- verified below.
 */
test.describe('Account Reconciliation', () => {
  test('reconciling to a different balance updates the account via an adjustment transaction', async ({page}) => {
    await page.goto('/accounts');
    const account = await createTestAccount(page, 'E2E Reconcile');

    await page.reload();
    const row = page.getByRole('row', {name: new RegExp(account.name)});
    // The reconcile/edit/delete buttons are icon-only with a pTooltip, which PrimeNG doesn't
    // wire up as an accessible name -- they all render as role=button with name "". Target by
    // icon class instead.
    await row.locator('button:has(.pi-sync)').click();

    // app-drawer renders PrimeNG's p-drawer (a side panel), which uses role="complementary",
    // not role="dialog" -- and its title isn't wired up as that landmark's accessible name.
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: `Reconcile ${account.name}`})).toBeVisible();
    await expect(drawer.getByText('$1,000.00')).toBeVisible();

    // id="targetBalance" lands on the <p-inputnumber> host element, not the inner native
    // <input> -- target the real input by its role instead.
    await drawer.getByRole('spinbutton').pressSequentially('1200', {delay: 30});

    // Wait for the reactively-computed adjustment preview to settle before clicking --
    // otherwise the click can race the re-render it triggers on every keystroke.
    await expect(drawer.getByText('+$200.00')).toBeVisible();
    await drawer.getByRole('button', {name: 'Reconcile'}).click();

    await expect(page.getByText('Account reconciled successfully')).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(row.getByText('$1,200.00')).toBeVisible();
  });

  test('reconciling to the same balance creates no adjustment', async ({page}) => {
    await page.goto('/accounts');
    const account = await createTestAccount(page, 'E2E Reconcile Balanced');

    await page.reload();
    const row = page.getByRole('row', {name: new RegExp(account.name)});
    // The reconcile/edit/delete buttons are icon-only with a pTooltip, which PrimeNG doesn't
    // wire up as an accessible name -- they all render as role=button with name "". Target by
    // icon class instead.
    await row.locator('button:has(.pi-sync)').click();

    // app-drawer renders PrimeNG's p-drawer (a side panel), which uses role="complementary",
    // not role="dialog" -- and its title isn't wired up as that landmark's accessible name.
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('heading', {name: `Reconcile ${account.name}`})).toBeVisible();
    // id="targetBalance" lands on the <p-inputnumber> host element, not the inner native
    // <input> -- target the real input by its role instead.
    await drawer.getByRole('spinbutton').pressSequentially('1000', {delay: 30});

    await expect(drawer.getByText('Balanced!')).toBeVisible();
    await expect(drawer.getByText('Adjustment Transaction')).not.toBeVisible();
  });
});
