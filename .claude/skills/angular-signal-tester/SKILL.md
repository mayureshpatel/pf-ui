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

## 🚨 Gotchas
- **If the code under test uses `effect()` to produce a value another part of the component
  reads, that's itself worth flagging, not just testing as-is.** This project shipped exactly that
  bug once (`CategoryChartComponent`/PF-189 — `effect()` used to compute derived chart-options
  state instead of `computed()`, so the value silently stayed stale). A passing test around an
  `effect()`-based derived value can still be testing broken behavior — see
  `angular-signal-store-architect`'s own Gotcha for why `computed()` is almost always the correct
  choice for derivation.
