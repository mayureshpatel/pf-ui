---
name: playwright-e2e-tester
description: Generates robust End-to-End (E2E) functional tests using Playwright. Use when testing critical business flows like CSV ingestion, User Registration, and Account Reconciliation across the full stack.
---

# Playwright E2E Tester

This skill guides the creation of multi-step, full-stack functional tests using Playwright.

## Core Workflow
1. **Setup**: Tests must run against a fully integrated local environment (UI + API + DB).
2. **Authentication**: Use `global-setup.ts` or inject JWT tokens directly into `localStorage` to bypass login screens and speed up execution for non-auth tests.
3. **Locators**: Use resilient locators (e.g., `getByRole`, `getByTestId`, `getByText`) instead of brittle CSS classes or XPaths.

## Technical Standards
- Group tests logically using `test.describe()`.
- Use `test.step()` to document complex business flows (e.g., "Step 1: Upload CSV", "Step 2: Reconcile").
- Ensure assertions use Playwright's auto-retrying matchers (e.g., `expect(locator).toBeVisible()`).
