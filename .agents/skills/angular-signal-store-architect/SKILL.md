---
name: angular-signal-store-architect
description: Generates state management logic using Angular 21 Signals. Trigger this skill to enforce the strict 'No RxJS' mandate for local and global state.
---

# Angular Signal Store Architect

This skill enforces the use of modern Signals for state management over legacy RxJS paradigms.

## 🚨 Architectural Constraints
- **No RxJS**: Avoid `BehaviorSubject`, `Observable`, and `pipe()` unless specifically interfacing with the Angular `HttpClient`.
- **Signals First**: Use `signal()`, `computed()`, and `effect()` exclusively for state mutations and derived state.
- **Immutability**: Always update signals using `.set()` or `.update()` returning new object references. Do not mutate objects in place.

## 🛠 Procedural Workflow
1. **State Definition**: Define the primitive or object state using `signal<T>(...)`.
2. **Derived State**: Use `computed(() => ...)` to automatically calculate aggregations (e.g., Total Balance) without manual recalculation triggers.
3. **Side Effects**: Use `effect(() => ...)` sparingly, primarily for syncing state to `localStorage` or triggering external APIs.
4. **HTTP Interop**: When calling `HttpClient`, immediately convert the Observable response to a Signal using `toSignal()`.
