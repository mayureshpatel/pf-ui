import {chromium, FullConfig} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.resolve(__dirname, '.auth/user.json');
const TOKEN_KEY = 'pf_auth_token';
const STORAGE_TYPE_KEY = 'pf_storage_type';

/**
 * Logs in as a pre-existing test user once, before the whole suite runs, and caches the
 * resulting session (JWT in localStorage) to disk. Every test project then starts already
 * authenticated via `use.storageState`, instead of re-running the login UI flow per test.
 *
 * Requires E2E_USERNAME / E2E_PASSWORD to already exist as a real user against whichever
 * backend E2E_API_URL points at -- this does not create that user. See e2e/README.md.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:4200';
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
    data: {username, password}
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

  const {token} = (await response.json()) as {token: string};

  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ({tokenKey, storageTypeKey, jwt}) => {
      localStorage.setItem(tokenKey, jwt);
      localStorage.setItem(storageTypeKey, 'local');
    },
    {tokenKey: TOKEN_KEY, storageTypeKey: STORAGE_TYPE_KEY, jwt: token}
  );

  fs.mkdirSync(path.dirname(AUTH_FILE), {recursive: true});
  await context.storageState({path: AUTH_FILE});

  await browser.close();
}
