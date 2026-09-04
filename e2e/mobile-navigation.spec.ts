import {expect, test} from '@playwright/test';

/**
 * PF-285: the mobile nav drawer used to render inside a `hidden lg:block` ancestor, so it stayed
 * invisible below the `lg` breakpoint no matter its own visible state -- the hamburger button
 * opened a drawer that was there in the DOM but never actually shown. Fixed via `appendTo="body"`
 * on the `<p-drawer>` in shell.component.html, which portals its rendered content out of that
 * ancestor. These tests fail against the pre-fix markup (the drawer's contents never become
 * visible) and pass once the portal is in place.
 */
test.describe('Mobile navigation drawer (PF-285)', () => {
  test('the hamburger button opens a genuinely visible, usable nav drawer below lg width', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);

    // Icon-only button, no accessible name yet -- structural locator, not role+name.
    await page.locator('header button:has(.pi-bars)').click();

    // Scoped to the drawer panel itself: the always-present desktop sidebar shares the same
    // "Transactions" link text and "Main Navigation" aria-label, so an unscoped role locator
    // would be ambiguous (2 matches) regardless of which one is actually visible.
    const transactionsLink = page.locator('.p-drawer').getByRole('link', {name: 'Transactions'});
    await expect(transactionsLink).toBeVisible();

    await transactionsLink.click();
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test('desktop navigation is unaffected: the sidebar is visible and the hamburger is hidden', async ({page}) => {
    await page.setViewportSize({width: 1280, height: 800});
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(page.locator('header button:has(.pi-bars)')).toBeHidden();
    await expect(page.getByRole('navigation', {name: 'Main Navigation'}).first()).toBeVisible();
  });
});
