---
name: design-system-auditor
description: Audits Angular component templates to enforce Tailwind CSS usage over inline styles and ensures adherence to the core thematic design system. Trigger this skill during UI code reviews.
---
# Design System Auditor

This skill prevents "UX Drift" by ensuring all UI developers (AI or human) strictly utilize the centralized Tailwind Design System rather than hardcoding colors or padding.

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
