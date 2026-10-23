import { Transaction, TransactionType } from '@models/transaction.model';
import { groupByDay } from './transaction-day-groups';

function txn(id: number, date: string, type: TransactionType, amount: number): Transaction {
  return { id, date, type, amount } as Transaction;
}

const OPTIONS = { today: new Date(2026, 9, 17), page: 0, pageCount: 1 };

describe('groupByDay', () => {
  it('should return no groups for no transactions', () => {
    // assert & verify
    expect(groupByDay([], OPTIONS)).toEqual([]);
  });

  it('should group consecutive rows of the same day and keep input order', () => {
    // arrange
    const rows = [
      txn(1, '2026-10-17T09:00:00Z', TransactionType.EXPENSE, 10),
      txn(2, '2026-10-17T08:00:00Z', TransactionType.EXPENSE, 5),
      txn(3, '2026-10-15T08:00:00Z', TransactionType.INCOME, 100),
    ];

    // act
    const groups = groupByDay(rows, OPTIONS);

    // assert & verify
    expect(groups.map((g) => g.key)).toEqual(['2026-10-17', '2026-10-15']);
    expect(groups[0].transactions.map((t) => t.id)).toEqual([1, 2]);
  });

  it('should compute net as income minus expense and ignore transfers and adjustments', () => {
    // arrange
    const rows = [
      txn(1, '2026-10-15', TransactionType.INCOME, 3200),
      txn(2, '2026-10-15', TransactionType.EXPENSE, 62.4),
      txn(3, '2026-10-15', TransactionType.TRANSFER, 500),
      txn(4, '2026-10-15', TransactionType.TRANSFER_IN, 500),
      txn(5, '2026-10-15', TransactionType.ADJUSTMENT, 9),
    ];

    // act
    const [group] = groupByDay(rows, OPTIONS);

    // assert & verify
    expect(group.net).toBe(3137.6);
  });

  it('should label today, yesterday, this year and other years', () => {
    // arrange
    const rows = [
      txn(1, '2026-10-17', TransactionType.EXPENSE, 1),
      txn(2, '2026-10-16', TransactionType.EXPENSE, 1),
      txn(3, '2026-10-15', TransactionType.EXPENSE, 1),
      txn(4, '2025-12-31', TransactionType.EXPENSE, 1),
    ];

    // act
    const labels = groupByDay(rows, OPTIONS).map((g) => g.label);

    // assert & verify
    expect(labels).toEqual(['Today', 'Yesterday', 'Thursday, Oct 15', 'Wednesday, Dec 31, 2025']);
  });

  it('should mark the first group partial after page one and the last before the final page', () => {
    // arrange
    const rows = [
      txn(1, '2026-10-17', TransactionType.EXPENSE, 1),
      txn(2, '2026-10-16', TransactionType.EXPENSE, 1),
      txn(3, '2026-10-15', TransactionType.EXPENSE, 1),
    ];

    // act
    const middle = groupByDay(rows, { today: OPTIONS.today, page: 1, pageCount: 3 });
    const only = groupByDay(rows, OPTIONS);

    // assert & verify
    expect(middle.map((g) => g.partial)).toEqual([true, false, true]);
    expect(only.map((g) => g.partial)).toEqual([false, false, false]);
  });

  it('should mark a single group partial when either neighbouring page exists', () => {
    // arrange
    const rows = [txn(1, '2026-10-17', TransactionType.EXPENSE, 1)];

    // act and assert & verify
    expect(groupByDay(rows, { today: OPTIONS.today, page: 0, pageCount: 2 })[0].partial).toBe(true);
    expect(groupByDay(rows, { today: OPTIONS.today, page: 1, pageCount: 2 })[0].partial).toBe(true);
  });
});
