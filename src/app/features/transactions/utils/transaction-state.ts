import { TransactionState } from '@models/transaction.model';

/** Serializes with object keys sorted, so two equal values always give the same string. */
function canonical(state: TransactionState): string {
  return JSON.stringify(state, (_key: string, value: unknown): unknown => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}

/**
 * Whether two page states mean the same thing. Compares by value and ignores the order the
 * fields were added in (a filter built by the user and the same filter rebuilt from the URL list
 * their keys differently), so the page does not reload when nothing changed. Dates are compared
 * by value, and a field set to undefined counts as absent.
 *
 * @param a - One state.
 * @param b - The other state.
 */
export function isSameTransactionState(a: TransactionState, b: TransactionState): boolean {
  return canonical(a) === canonical(b);
}
