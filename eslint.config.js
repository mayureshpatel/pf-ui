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
      // Disable core/typescript-eslint stylistic rules that would conflict with Prettier's own
      // formatting, then run Prettier itself as a lint rule so formatting drift fails `ng lint`
      // the same as any other violation, matching pf-ui/CLAUDE.md's single-quote/Prettier rule.
      ...prettierConfigRules,
      "prettier/prettier": "error",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  }
]);
