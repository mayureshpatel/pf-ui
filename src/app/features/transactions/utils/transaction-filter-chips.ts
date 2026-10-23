import { TransactionFilter, TransactionType } from '@models/transaction.model';

/** The `categoryName` filter value meaning "no category" (the value the dashboard link uses). */
export const UNCATEGORIZED = 'null';

/** Filters that appear as removable chips (the period and the search box have their own controls). */
export type FilterChipKey =
  | 'accountId'
  | 'categoryName'
  | 'merchant'
  | 'type'
  | 'amount'
  | 'tagId';

/** One applied filter, ready to render as a removable chip. */
export interface FilterChip {
  key: FilterChipKey;
  label: string;
}

const TYPE_LABELS: Partial<Record<TransactionType, string>> = {
  [TransactionType.INCOME]: 'Income',
  [TransactionType.EXPENSE]: 'Expense',
  [TransactionType.TRANSFER]: 'Transfer',
  [TransactionType.ADJUSTMENT]: 'Adjustment',
};

const money = (value: number): string => `$${value.toLocaleString('en-US')}`;

function amountLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${money(min)} to ${money(max)}`;
  if (min !== undefined) return `Over ${money(min)}`;
  return `Under ${money(max as number)}`;
}

/**
 * The applied filters as removable chips, in a stable order.
 *
 * @param filter - The current filter.
 * @param lookups - Names for ids, so a chip can say "Checking" rather than "Account 3".
 */
export function buildFilterChips(
  filter: TransactionFilter,
  lookups: { accounts: { id: number; name: string }[]; tags: { id: number; name: string }[] },
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filter.accountId) {
    const account = lookups.accounts.find((a) => a.id === filter.accountId);
    chips.push({ key: 'accountId', label: account?.name ?? `Account ${filter.accountId}` });
  }
  if (filter.categoryName) {
    const uncategorized: boolean =
      filter.categoryName === UNCATEGORIZED || filter.categoryName === '__UNDEFINED__';
    chips.push({ key: 'categoryName', label: uncategorized ? 'Uncategorized' : filter.categoryName });
  }
  if (filter.merchant) {
    chips.push({ key: 'merchant', label: `Merchant: ${filter.merchant}` });
  }
  if (filter.type) {
    chips.push({ key: 'type', label: TYPE_LABELS[filter.type] ?? filter.type });
  }
  if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
    chips.push({ key: 'amount', label: amountLabel(filter.minAmount, filter.maxAmount) });
  }
  if (filter.tagId) {
    const tag = lookups.tags.find((t) => t.id === filter.tagId);
    chips.push({ key: 'tagId', label: `Tag: ${tag?.name ?? filter.tagId}` });
  }
  return chips;
}

/**
 * The filter with one chip's filter cleared. The amount chip clears both ends of the range.
 *
 * @param filter - The current filter.
 * @param key - The chip being removed.
 */
export function removeFilterChip(filter: TransactionFilter, key: FilterChipKey): TransactionFilter {
  if (key === 'amount') {
    return { ...filter, minAmount: undefined, maxAmount: undefined };
  }
  return { ...filter, [key]: undefined };
}
