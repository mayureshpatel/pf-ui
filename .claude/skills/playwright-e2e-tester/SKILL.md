---
name: playwright-e2e-tester
description: Generates robust End-to-End (E2E) functional tests using Playwright. Use when testing critical business flows like CSV ingestion, User Registration, and Account Reconciliation across the full stack.
---

# Playwright E2E Tester

This skill guides the creation of multi-step, full-stack functional tests using Playwright.

## Core Workflow
1. **Setup**: Tests must run against a fully integrated local environment (UI + API + DB).
2. **Authentication**: Use `global-setup.ts` or inject JWT tokens directly into `localStorage` to bypass login screens and speed up execution for non-auth tests.
3. **Locators**: Use resilient locators (e.g., `getByRole`, `getByText`, `getByLabel`) instead of brittle CSS classes or XPaths. Do NOT reach for `getByTestId` — see Gotchas.

## Technical Standards
- Group tests logically using `test.describe()`.
- Use `test.step()` to document complex business flows (e.g., "Step 1: Upload CSV", "Step 2: Reconcile").
- Ensure assertions use Playwright's auto-retrying matchers (e.g., `expect(locator).toBeVisible()`).

## 🚨 Gotchas
- **`getByTestId` will never match anything in this codebase today.** Zero `data-testid`
  attributes exist anywhere in `pf-ui` — confirmed via grep. Recommending it as an equally-valid
  option (as this skill previously did) sends an agent down a locator strategy that silently
  produces a test that can never pass, with no clear indication why. Use `getByRole`/`getByText`/
  `getByLabel` instead; if a specific element genuinely can't be targeted any of those ways, that's
  a real signal the markup itself needs an accessible role/label, not a `data-testid` workaround.
