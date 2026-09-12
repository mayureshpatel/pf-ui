---
name: design-system-auditor
description: Audits Angular component templates to enforce Tailwind CSS usage, the core thematic design system, and the full design-system.md spec (destructive-action styling, date/currency formatting, modal-vs-drawer sizing). Trigger this skill during UI code reviews.
---
# Design System Auditor

This skill prevents "UX Drift" by ensuring all UI developers (AI or human) strictly utilize the centralized Tailwind Design System rather than hardcoding colors or padding, and follow the conventions documented in `docs/technical/03-frontend-angular/design-system.md` (color usage, typography, spacing, modal-vs-drawer sizing, destructive-action styling, date/currency formatting, icon usage).

The two original checks below (inline styles, arbitrary values) are also mechanically enforced by
`.claude/hooks/check-design-system-drift.py` (a root-repo Stop hook, PF-279) — as are checks 1-3
under "Expanded Checks" (PF-280). Check 4 (modal-vs-drawer sizing) is a soft, advisory-only heuristic
there, matching its treatment here: a signal worth noting, not something to hard-block on.

## 🚨 Constraints & Guardrails
- **No Inline Styles:** You MUST reject any `.html` or `.ts` file containing `style="..."` attributes.
- **No Hardcoded Values:** You MUST reject arbitrary Tailwind arbitrary values (e.g., `text-[#1da1f2]` or `p-[17px]`). They must use the defined theme variables (e.g., `text-primary`, `p-4`).
- **Framework Constraint:** We use Tailwind CSS v4. Ensure classes adhere to the v4 specification.

## 🛠 Procedural Workflow
1. **Analyze Template:** Read the provided `.html` Angular template.
2. **Scan for Violations:**
   - Use regex or semantic parsing to flag any `style=` attributes.
   - Flag any brackets `[]` used inside Tailwind class strings that indicate hardcoded arbitrary values.
3. **Cross-Reference Theme:** The color source of truth is `FinancePreset` in
   `src/app/custom-presets.ts` (PrimeNG's JS-based theming) — check there for the correct semantic
   token (e.g. `primary`, `surface`) to replace a hardcoded value with. `src/styles.css` only
   defines the `@custom-variant dark` selector and Tailwind's own utility layer; no `--primary` or
   other color custom property is defined there. Tailwind v4 does NOT use `tailwind.config.ts`.
4. **Refactor:** Output the refactored, cleanly-styled component template.

## 🚨 Expanded Checks (PF-280, per `design-system.md`)
1. **Destructive-Action Styling:** You MUST reject a delete/destructive-action button (icon
   `pi-trash` or equivalent, or any button whose handler calls a `delete*`/`remove*` method) that is
   missing `severity="danger"`. This also covers non-delete irreversible actions styled the same way
   (e.g. a merge confirmation) — the rule is "irreversible," not literally "has a trash icon."
2. **Currency Formatting:** You MUST reject a raw Angular `currency:` pipe usage (e.g.
   `{{ amount | currency:'USD' }}`). The shared `FormatCurrencyPipe` is the sole currency-display
   path — refactor to use it instead.
3. **Date Formatting:** You MUST reject a direct `.toLocaleDateString(...)` or date-formatting
   `.toLocaleString(...)` call in a component instead of Angular's `DatePipe` (`| date`). **Do not**
   flag legitimate `| date` pipe usage itself — that already *is* the correct pattern. **Known
   exceptions**, already documented in `design-system.md`, are not violations: the shared
   `toLocalDateString()` utility's own definition (`shared/utils/transaction.utils.ts`), and Chart.js
   tooltip/axis-label callbacks (`cash-flow-trend.component.ts`, `income-expense-report.component.ts`,
   `category-chart.component.ts`) that format dates/numbers manually because neither pipe is usable
   inside a chart-config callback.
4. **Modal vs. Drawer Sizing (soft warning, not a hard rule):** When reviewing a *new* create/edit
   form, flag — don't auto-reject — a `p-dialog`-based form with 7+ fields, or a `DrawerComponent`
   (`<app-drawer>`)-based form with 6 or fewer, per the modal-vs-drawer rule in `design-system.md`.
   Field count is a heuristic starting point for a conversation, not something to hard-block on;
   action/workflow dialogs (file upload, matching, bulk-apply flows) fall outside this rule
   regardless of field count.
