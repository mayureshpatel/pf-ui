---
name: angular-component-tester
description: Generates high-quality component tests for Angular 21 using Vitest. Use when testing UI interactions, DOM rendering, and component lifecycle events.
---

# Angular Component Tester

This skill guides the creation of robust DOM and interaction tests for Angular components.

## Core Workflow
1. **Setup**: Use `TestBed.configureTestingModule()`.
2. **Rendering**: Test that signals correctly project into the DOM elements.
3. **Interactions**: Simulate user clicks, inputs, and form submissions.

## Technical Standards
- Avoid deep component trees; use Mock components or ignore child elements to maintain unit isolation.
- Verify that UI interactions successfully mutate the underlying Signal state.
- Follow the AAA (Arrange, Act, Assert) pattern.
- **Test Co-location**: place the spec file alongside the component it tests (e.g.,
  `accounts.component.spec.ts` next to `accounts.component.ts`). Do not create a separate `/test/`
  directory.
