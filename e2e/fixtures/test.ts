import { expect, test as base } from '@playwright/test';
import { cleanupTracked } from '../helpers/cleanup';

/**
 * Playwright's `test` with one addition: after every test, pass or fail, whatever the test created
 * through the `createTestX` helpers (or `track`) is deleted again. Specs import `test` and `expect`
 * from here instead of `@playwright/test`.
 */
export const test = base.extend<{ cleanup: void }>({
  cleanup: [
    async ({ context, request }, use) => {
      await use();
      await cleanupTracked(context, request);
    },
    { auto: true },
  ],
});

export { expect };
