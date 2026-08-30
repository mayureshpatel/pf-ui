---
name: tsdoc-documenter
description: Generates standardized TSDoc comments for Angular components, Signals, and Stores. Trigger this skill when asked to document the frontend codebase.
---
# TSDoc Documenter

This skill enforces strict documentation standards for the Angular 21 frontend.

## 🚨 Constraints & Guardrails
- **Syntax:** You MUST use the standard `/** ... */` block format. Do not use `//` for architectural documentation.
- **Signals:** When documenting a `Signal` or `computed()`, clearly state what state it holds and what side-effects it triggers.
- **Component Inputs/Outputs:** Use `@param` equivalent tags or clear descriptions for `input()` and `output()` signals.

## 🛠 Procedural Workflow
1. Read the target `.ts` file.
2. Identify all `export class`, `input()`, `output()`, and `computed()` declarations.
3. Write standard TSDoc comments explaining the *Why*, not just the *What*.
4. Ensure no HTML tags are injected into the TSDoc unless they are part of a `@example` code block.
