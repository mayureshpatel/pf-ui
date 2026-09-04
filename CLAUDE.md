# Frontend (`pf-ui`) Instructions

## Framework & Tooling
- **Framework:** Angular v21 (Signals-based).
- **Styling:** Tailwind CSS v4 and PrimeNg v21. 
	- **Theme:** "Soft & Friendly" (rounded corners, earthy/calm primary colors).
	- **Customization:** The color source of truth is `FinancePreset` in `src/app/custom-presets.ts`
	  (PrimeNG's JS-based theming), not `src/styles.css` — `styles.css` only defines the
	  `@custom-variant dark` selector (`.my-app-dark`) and Tailwind's own utility layer. Known gap
	  (PF-EPIC-031): `FinancePreset`'s `colorScheme.dark.surface` is currently an exact copy of
	  `.light.surface`, and nothing in the app toggles `.my-app-dark` at all, so dark mode has no
	  effect today regardless of theme.
- **State Management:** Strictly use **Signals**. Avoid RxJS where Signals are more appropriate.

## Components & Naming
- **File Naming:** Use `<feature-name>.component.[ts|html|css]`.
- **Class Naming:** Class names MUST use PascalCase WITH the "Component" suffix (e.g.,
  `export class UserProfileComponent`), matching Angular CLI conventions and 35 of 36
  `.component.ts` files in this codebase.
- **Formatting:** Ensure all code is formatted using **Prettier** — configured in
  `package.json` (`singleQuote: true`, `printWidth: 100`). Single quotes, not double, is the
  correct, enforced convention; there is no project-wide double-quote rule.

## Error Handling & Feedback
- **Global Handling:** Use Global Angular Error Handlers and HTTP Interceptors.
- **User Feedback:** Use **Toast** notifications for safely vague error information.
- **Logging:** Keep frontend logging to an absolute minimum.

## Testing Mandate
- **Bug Fixes (TDD):** Adhere strictly to Test-Driven Development for bugs. You must write a failing test that reproduces the issue *before* applying the fix.
- **Architecture:** Tests must test *behavior*, not internal implementation details.
- **Test Co-location:** Unit test files (`.spec.ts`) are co-located alongside the source file they
  test (e.g., `accounts.component.spec.ts` lives next to `accounts.component.ts`). Maintain this
  convention for all new tests — there is no separate `/test/` directory.
