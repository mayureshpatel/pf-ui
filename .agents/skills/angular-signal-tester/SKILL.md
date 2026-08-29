---
name: angular-signal-tester
description: Generates high-quality unit tests for Angular 21 Signals and Services using Vitest. Use when testing state management, computed signals, and data services to ensure robust state mutations without DOM overhead.
---

# Angular Signal Tester

This skill guides the creation of unit tests for Angular 21 Signals and services using Vitest.

## Core Workflow
1. **Runner**: Use Vitest for ultra-fast testing.
2. **Signals**: Test `WritableSignal`, `computed()`, and `effect()` behaviors. Ensure signal mutations propagate correctly.
3. **Injection**: Use `TestBed.inject()` or `runInInjectionContext` for service instantiation.
4. **Mocking**: Mock HTTP calls using `HttpTestingController` or Vitest `vi.mock()`.

## Technical Standards
- Avoid testing DOM elements in this skill; focus purely on the TypeScript logic and state.
- Assert signal values by calling them (e.g., `expect(service.mySignal()).toBe(...)`).
- Ensure all tests follow the AAA (Arrange, Act, Assert) pattern.
