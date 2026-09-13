// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const prettierPlugin = require("eslint-plugin-prettier");
const prettierConfigRules = require("eslint-config-prettier").rules;

module.exports = defineConfig([
  {
    // Generated/cached output and non-source content, not the actual app -- .angular/cache in
    // particular contains bundled third-party vendor code (Vite's dep pre-bundling), and linting
    // it produces thousands of meaningless violations against code this project doesn't own.
    ignores: [
      ".angular/**",
      ".claude/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "**/__screenshots__/**",
      ".vitest-attachments/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      // prefer-inject and prefer-standalone (pf-ui/CLAUDE.md's inject()-over-constructor and
      // standalone-only conventions) are already 'error' in this recommended set.
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // pf-ui/CLAUDE.md: "Class names MUST use PascalCase WITH the 'Component' suffix".
      "@angular-eslint/component-class-suffix": ["error", {suffixes: ["Component"]}],
      // pf-ui/CLAUDE.md: OnPush is the standard (PF-EPIC-020 brought the app to 100% adoption on
      // 2026-09-11); catches both new regressions and any drift from features built since then.
      "@angular-eslint/prefer-on-push-component-change-detection": "error",
      // Angular route guards (CanActivateFn) have a fixed (route, state) signature regardless of
      // whether a given guard's own logic needs both -- prefix an intentionally-unused parameter
      // with `_` rather than force every guard to pretend it uses arguments it doesn't.
      "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
      // PF-328 triage (2026-09-13): 199 pre-existing instances, spanning ~60 files -- far too
      // broad to fix as part of standing up the linter itself. Downgraded to a visible warning
      // (still surfaced in `ng lint` output) rather than silenced outright; a real pass to
      // introduce proper types belongs in its own dedicated follow-up ticket.
      "@typescript-eslint/no-explicit-any": "warn",
      // Disable core/typescript-eslint stylistic rules that would conflict with Prettier's own
      // formatting, then run Prettier itself as a lint rule so formatting drift fails `ng lint`
      // the same as any other violation, matching pf-ui/CLAUDE.md's single-quote/Prettier rule.
      ...prettierConfigRules,
      "prettier/prettier": "error",
    },
  },
  {
    // Angular's own generated root component (`app.ts`/`App`, no "Component" suffix, not even a
    // `.component.ts` filename) is the CLI's own modern convention for the app shell, not a
    // violation of pf-ui/CLAUDE.md's rule for feature components.
    files: ["src/app/app.ts"],
    rules: {
      "@angular-eslint/component-class-suffix": "off",
    },
  },
  {
    // Empty arrow-function/method stubs are a legitimate, common pattern in spec files: a
    // ResizeObserver/IntersectionObserver polyfill's own required methods, or a host component's
    // placeholder callback that a test later replaces with `vi.spyOn(...)`. Neither is dead code.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Template equivalent of the same "== null / != null is a legitimate, intentional
      // both-null-and-undefined check" exception applied elsewhere in this codebase -- e.g.
      // category-rules.component.html's `rule.minAmount != null`, where minAmount is a genuinely
      // optional (not required) numeric field.
      "@angular-eslint/template/eqeqeq": ["error", {allowNullOrUndefined: true}],
      // PF-328 triage (2026-09-13): 7 pre-existing instances across 4 files, each involving a
      // different PrimeNG form control (p-select, p-inputNumber, p-checkbox, a card-style radio
      // label) -- fixing these correctly needs per-control verification, not a mechanical pass,
      // and at least one flagged instance may be a false positive (a label wrapping its control
      // directly, which the linter doesn't appear to recognize as already-associated). Downgraded
      // to a visible warning; a real accessibility pass belongs in its own follow-up ticket,
      // matching this project's existing precedent (PF-EPIC-033) of dedicated a11y-focused work.
      "@angular-eslint/template/label-has-associated-control": "warn",
    },
  }
]);
