import {defineConfig, devices} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// e2e/.env (gitignored) may hold E2E_USERNAME / E2E_PASSWORD / E2E_API_URL so they need not be
// typed on every run; variables already set in the shell win over the file
const ENV_FILE = path.resolve(__dirname, 'e2e/.env');
if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const AUTH_FILE = path.resolve(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    storageState: AUTH_FILE
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']}
    }
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  }
});
