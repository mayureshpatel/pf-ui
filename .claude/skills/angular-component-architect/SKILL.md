---
name: angular-component-architect
description: Generates UI components using Angular 21, Tailwind CSS v4, and PrimeNG. Trigger this skill for all visual elements to ensure modern, accessible, and reactive DOM rendering.
---

# Angular Component Architect

This skill governs the creation of the presentation layer in the frontend.

## 🚨 Architectural Constraints
- **Frameworks**: Strictly use Angular 21, Tailwind CSS v4, and PrimeNG v21. Do NOT use Angular Material, Bootstrap, or legacy frameworks.
- **Standalone**: All components MUST be `standalone: true`.
- **Theme**: Adhere to the "Soft & Friendly" design system (rounded corners, earthy primary colors). The color source of truth is `FinancePreset` in `src/app/custom-presets.ts` (PrimeNG's JS-based theming) — `styles.css` only defines the `@custom-variant dark` selector and Tailwind's utility layer, not the color palette.
- **Naming**: Use PascalCase WITH the "Component" suffix for class names (e.g., `export class UserProfileComponent`), matching Angular CLI conventions and the existing codebase.

## 🛠 Procedural Workflow
1. **Logic (TS)**: Use `inject()` for dependency injection instead of constructors.
2. **Template (HTML)**: Use modern Angular Control Flow (`@if`, `@for`) instead of `*ngIf` and `*ngFor`.
3. **Styling (CSS)**: Rely on Tailwind utility classes inline. Only write custom CSS for complex animations or overrides.

## 📚 References
See `references/angular-component-gold-source.ts` (paired with the matching `.html`) for a real
component demonstrating `standalone: true`, `inject()`, `@if` control flow, and Tailwind utility
classes with no inline styles.
