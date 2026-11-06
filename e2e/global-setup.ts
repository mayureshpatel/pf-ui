import {chromium, FullConfig} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.resolve(__dirname, '.auth/user.json');

/**
 * Logs in as a pre-existing test user once, before the whole suite runs, and caches the
 * resulting session (the HttpOnly `pf_refresh` cookie, not a token in storage: the app restores its session from that cookie on startup, PF-899) to disk. Every test project then starts already
 * authenticated via `use.storageState`, instead of re-running the login UI flow per test.
 *
 * Requires E2E_USERNAME / E2E_PASSWORD to already exist as a real user against whichever
 * backend E2E_API_URL points at -- this does not create that user. See e2e/README.md.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';
  const username = process.env['E2E_USERNAME'];
  const password = process.env['E2E_PASSWORD'];

  if (!username || !password) {
    throw new Error(
      'E2E_USERNAME and E2E_PASSWORD must be set before running the E2E suite. ' +
        'See pf-ui/e2e/README.md for how to provision the test user they identify.'
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  const response = await context.request.post(`${apiUrl}/auth/authenticate`, {
    data: {username, password, rememberMe: true}
  });

  if (!response.ok()) {
    const status = response.status();
    const body = await response.text();
    await browser.close();
    throw new Error(
      `E2E login failed for user '${username}' against ${apiUrl}: ${status} ${body}. ` +
        'Confirm the backend is running and the test user exists with this password.'
    );
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), {recursive: true});
  await context.storageState({path: AUTH_FILE});

  await browser.close();
}
