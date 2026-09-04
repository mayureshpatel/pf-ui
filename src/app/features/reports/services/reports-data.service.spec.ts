import {ReportsDataService} from './reports-data.service';
import {Transaction, TransactionType} from '@models/transaction.model';

describe('ReportsDataService', () => {
  let service: ReportsDataService;

  const txn = (date: string, type: TransactionType, amount: number): Transaction =>
    ({
      id: 1,
      account: {} as Transaction['account'],
      category: {} as Transaction['category'],
      amount,
      date,
      description: 'test',
      type,
      merchant: {} as Transaction['merchant']
    }) as Transaction;

  beforeEach(() => {
    service = new ReportsDataService();
  });

  describe('aggregateByMonth (PF-213)', () => {
    it('should key each month by the first 7 characters of the UTC date string', () => {
      // arrange & act -- transactions.model.ts's date field is always a plain ISO string at
      // runtime (Angular's HttpClient never constructs a real Date from JSON), never an actual
      // Date instance
      const result = service.aggregateByMonth([
        txn('2026-03-15T00:00:00Z', TransactionType.INCOME, 1000),
        txn('2026-03-20T00:00:00Z', TransactionType.EXPENSE, 200),
        txn('2026-04-01T00:00:00Z', TransactionType.EXPENSE, 50)
      ]);

      // assert & verify
      expect(result.map((r): string => r.month)).toEqual(['2026-03', '2026-04']);
      expect(result[0]).toEqual({month: '2026-03', income: 1000, expense: 200, netSavings: 800});
      expect(result[1]).toEqual({month: '2026-04', income: 0, expense: 50, netSavings: -50});
    });

    it('should exclude transfers from both income and expense totals', () => {
      // arrange & act
      const result = service.aggregateByMonth([
        txn('2026-03-15T00:00:00Z', TransactionType.TRANSFER, 500)
      ]);

      // assert & verify -- a transfer-only month contributes no entry at all
      expect(result).toEqual([]);
    });
  });
});
