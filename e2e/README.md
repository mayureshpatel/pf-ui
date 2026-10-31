# E2E Tests (Playwright)

## Prerequisites

1. **Backend running** at the URL `E2E_API_URL` points to (default `http://localhost:8080/api/v1`).
   `playwright.config.ts` only auto-starts the frontend (`npm run start`) via its `webServer`
   option — the backend is a separate service with its own database and env vars (see
   `pf-data-service/CLAUDE.md`) and isn't started automatically here.
2. **A test user must already exist** against that backend, with a known username/password.
   `global-setup.ts` logs in as this user once before the suite runs and caches the resulting
   session for every test — it does not create the account.

   There's no self-service registration to do this with: `POST /auth/register` requires
   `ROLE_ADMIN` (see `AuthenticationController`), and no seed/bootstrap data creates a default
   user anywhere in this repo. Create one directly, e.g. against your local Postgres:

   ```sql
   -- password hash below is bcrypt for a password of your choosing; generate your own with
   -- `htpasswd -nbB <username> <password>` (ships with macOS) or any bcrypt tool -- Spring
   -- Security's BCryptPasswordEncoder accepts the $2a$/$2b$/$2y$ variants interchangeably.
   INSERT INTO users (username, password_hash, email, last_updated_by, role)
   VALUES ('<username>', '<bcrypt-hash>', '<username>@example.com', 'system', 'USER');
   ```

## Running

```bash
E2E_USERNAME=<username> E2E_PASSWORD=<password> npm run e2e
```

Optional env vars:
- `E2E_API_URL` — backend base URL (default `http://localhost:8080/api/v1`).
- `CI` — when set, disables reusing an already-running dev server and enables retries.

`npm run e2e:ui` opens Playwright's UI mode for interactive debugging.

## Layout
- `global-setup.ts` — logs in once, caches the session to `e2e/.auth/user.json` (gitignored).
  Every test starts already authenticated via `playwright.config.ts`'s `use.storageState`.
- `harness.smoke.spec.ts` — proves the harness itself works (auth caching + route guards).
  Business-flow coverage lives in other spec files, not here.

## Cleaning up after tests
Specs import `test` and `expect` from `./fixtures/test`, not `@playwright/test`. That `test` deletes whatever
a test created after it ends, pass or fail: every `createTestX` helper in `helpers/api.ts` records what it
creates, and rows made through the UI are recorded with `trackByName(page, 'account' | 'merchant' | 'tag', name)`
right after the UI step. Deletion order is transactions (everything on a tracked account), budgets, tags,
categories (newest first), merchants, accounts. Users made with `registerTestUser` are not cleaned up (they are
separate users).

`python3 e2e/leftovers.py` prints the E2E user's account/category/tag/merchant/transaction counts; run it before
and after a suite and the numbers must match. `--dry-run` lists the rows whose names start with `E2E` and
`--apply` deletes them (the one-time cleanup of leftovers from before this fixture existed).
