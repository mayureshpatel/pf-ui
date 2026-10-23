import { Transaction, TransactionType } from '@models/transaction.model';
import { toLocalDateString } from '@shared/utils/transaction.utils';

/** One day's worth of rows on the current page, with its heading and net total. */
export interface DayGroup {
  key: string;
  label: string;
  net: number;
  partial: boolean;
  transactions: Transaction[];
}

const WEEKDAY_MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAY_MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Rounds to whole cents so floating point noise never reaches the screen. */
const toCents = (value: number): number => Math.round(value * 100) / 100;

function labelFor(key: string, today: Date): string {
  const todayKey: string = toLocalDateString(today);
  const yesterday: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === todayKey) return 'Today';
  if (key === toLocalDateString(yesterday)) return 'Yesterday';
  const date: Date = new Date(`${key}T00:00:00Z`);
  const sameYear: boolean = key.substring(0, 4) === todayKey.substring(0, 4);
  return (sameYear ? WEEKDAY_MONTH_DAY : WEEKDAY_MONTH_DAY_YEAR).format(date);
}

function signedAmount(txn: Transaction): number {
  if (txn.type === TransactionType.INCOME) return txn.amount;
  if (txn.type === TransactionType.EXPENSE) return -txn.amount;
  return 0;
}

/**
 * Groups one page of transactions (already sorted by date by the server) into days.
 *
 * Because paging is server-side, a day can continue on a neighbouring page, so the first group is
 * marked partial when a previous page exists and the last when a next page exists. The daily net
 * total only covers the rows on this page.
 *
 * @param transactions - The loaded page, in display order.
 * @param options - Today's date (for "Today"/"Yesterday" labels) and the zero-based page position.
 * @returns The day groups in display order.
 */
export function groupByDay(
  transactions: Transaction[],
  options: { today: Date; page: number; pageCount: number },
): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const txn of transactions) {
    const key: string = txn.date.substring(0, 10);
    const last: DayGroup | undefined = groups[groups.length - 1];
    if (last && last.key === key) {
      last.transactions.push(txn);
      last.net = toCents(last.net + signedAmount(txn));
    } else {
      groups.push({
        key,
        label: labelFor(key, options.today),
        net: toCents(signedAmount(txn)),
        partial: false,
        transactions: [txn],
      });
    }
  }

  if (groups.length > 0) {
    if (options.page > 0) groups[0].partial = true;
    if (options.page < options.pageCount - 1) groups[groups.length - 1].partial = true;
  }
  return groups;
}
