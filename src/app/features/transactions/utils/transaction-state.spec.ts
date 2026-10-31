import { TransactionState } from '@models/transaction.model';
import { isSameTransactionState } from './transaction-state';

const state = (overrides: Partial<TransactionState> = {}): TransactionState => ({
  filter: {},
  page: 0,
  size: 20,
  sort: 'date,desc',
  ...overrides,
});

describe('isSameTransactionState (PF-869)', () => {
  it('should treat the same filter built in a different key order as equal', () => {
    // arrange -- the user picks the end date first; the URL echo builds start date first
    const a = state({
      filter: { endDate: new Date(2026, 9, 31), startDate: new Date(2026, 9, 1) },
    });
    const b = state({
      filter: { startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 31) },
    });

    // assert & verify
    expect(isSameTransactionState(a, b)).toBe(true);
  });

  it('should treat top-level fields in a different order as equal', () => {
    // assert & verify
    expect(
      isSameTransactionState(
        { sort: 'date,desc', size: 20, page: 0, filter: {} },
        { filter: {}, page: 0, size: 20, sort: 'date,desc' },
      ),
    ).toBe(true);
  });

  it('should ignore a filter field that is undefined', () => {
    // assert & verify
    expect(
      isSameTransactionState(state({ filter: { description: undefined } }), state({ filter: {} })),
    ).toBe(true);
  });

  it('should tell dates apart by value, not identity', () => {
    // assert & verify
    expect(
      isSameTransactionState(
        state({ filter: { startDate: new Date(2026, 9, 1) } }),
        state({ filter: { startDate: new Date(2026, 9, 1) } }),
      ),
    ).toBe(true);
    expect(
      isSameTransactionState(
        state({ filter: { startDate: new Date(2026, 9, 1) } }),
        state({ filter: { startDate: new Date(2026, 9, 2) } }),
      ),
    ).toBe(false);
  });

  it('should detect a real difference in a filter, page, size or sort', () => {
    // assert & verify
    expect(isSameTransactionState(state(), state({ filter: { description: 'x' } }))).toBe(false);
    expect(isSameTransactionState(state(), state({ page: 1 }))).toBe(false);
    expect(isSameTransactionState(state(), state({ size: 50 }))).toBe(false);
    expect(isSameTransactionState(state(), state({ sort: 'amount,asc' }))).toBe(false);
  });
});
