import { TransactionType } from '@models/transaction.model';
import { buildFilterChips, removeFilterChip, UNCATEGORIZED } from './transaction-filter-chips';

const LOOKUPS = {
  accounts: [{ id: 3, name: 'Checking' }],
  tags: [{ id: 7, name: 'weekly' }],
};

describe('transaction-filter-chips', () => {
  it('should produce no chips for an empty filter or one with only a period and search', () => {
    // assert & verify
    expect(buildFilterChips({}, LOOKUPS)).toEqual([]);
    expect(
      buildFilterChips(
        { description: 'shell', startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 31) },
        LOOKUPS,
      ),
    ).toEqual([]);
  });

  it('should label each applied filter in plain words', () => {
    // act
    const chips = buildFilterChips(
      {
        accountId: 3,
        categoryName: 'Groceries',
        merchant: 'Trader Joe',
        type: TransactionType.EXPENSE,
        minAmount: 20,
        tagId: 7,
      },
      LOOKUPS,
    );

    // assert & verify
    expect(chips).toEqual([
      { key: 'accountId', label: 'Checking' },
      { key: 'categoryName', label: 'Groceries' },
      { key: 'merchant', label: 'Merchant: Trader Joe' },
      { key: 'type', label: 'Expense' },
      { key: 'amount', label: 'Over $20' },
      { key: 'tagId', label: 'Tag: weekly' },
    ]);
  });

  it('should describe amount ranges and uncategorized', () => {
    // assert & verify
    expect(buildFilterChips({ maxAmount: 100 }, LOOKUPS)[0].label).toBe('Under $100');
    expect(buildFilterChips({ minAmount: 20, maxAmount: 100 }, LOOKUPS)[0].label).toBe(
      '$20 to $100',
    );
    expect(buildFilterChips({ categoryName: UNCATEGORIZED }, LOOKUPS)[0].label).toBe(
      'Uncategorized',
    );
    expect(buildFilterChips({ categoryName: '__UNDEFINED__' }, LOOKUPS)[0].label).toBe(
      'Uncategorized',
    );
  });

  it('should fall back to a generic label when an id is unknown', () => {
    // assert & verify
    expect(buildFilterChips({ accountId: 99 }, LOOKUPS)[0].label).toBe('Account 99');
    expect(buildFilterChips({ tagId: 99 }, LOOKUPS)[0].label).toBe('Tag: 99');
  });

  it('should remove a chip, clearing both ends of an amount range together', () => {
    // arrange
    const filter = { accountId: 3, minAmount: 20, maxAmount: 100, description: 'shell' };

    // act and assert & verify
    expect(removeFilterChip(filter, 'amount')).toEqual({
      accountId: 3,
      minAmount: undefined,
      maxAmount: undefined,
      description: 'shell',
    });
    expect(removeFilterChip(filter, 'accountId').accountId).toBeUndefined();
  });
});
