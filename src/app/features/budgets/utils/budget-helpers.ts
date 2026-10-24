import { Budget, BudgetStatus } from '@models/budget.model';
import { Category } from '@models/category.model';
import { toCents } from '@shared/utils/money.utils';

/** A category at or above this share of its limit (and not over it) is "close". */
export const CLOSE_THRESHOLD_PERCENT = 85;

export type BudgetGroupKey = 'OVER' | 'CLOSE' | 'ON_TRACK' | 'UNBUDGETED';

/** A status line joined with the id of its budget (null when it cannot be found). */
export interface BudgetRow {
  status: BudgetStatus;
  budgetId: number | null;
}

export interface BudgetRowGroup {
  key: BudgetGroupKey;
  label: 'Over the limit' | 'Close to the limit' | 'On track' | 'No limit set';
  leftSubtotal: number;
  /** Total spent across the group (what the No limit set heading shows). */
  spentSubtotal: number;
  rows: BudgetRow[];
}

export interface BudgetTotals {
  budgeted: number;
  spent: number;
  left: number;
  /** Spending in categories with no budget this month (kept out of the other totals). */
  unbudgeted: number;
}

const cents = (value: number): number => Math.round(value * 100);

/**
 * A category that has spending this month but no budget: the status endpoint reports it with a
 * limit of 0, which must not be read as a $0 budget.
 *
 * @param row - A status line joined with its budget id.
 */
export function isUnbudgeted(row: BudgetRow): boolean {
  return row.budgetId === null && cents(row.status.budgetedAmount) === 0;
}

/**
 * Joins each status line with the id of the budget it came from, so a row can be removed.
 *
 * @param statuses - The month's status lines.
 * @param budgets - The month's budgets.
 */
export function budgetRows(statuses: BudgetStatus[], budgets: Budget[]): BudgetRow[] {
  const ids = new Map<number, number>(budgets.map((b: Budget) => [b.category.id, b.id]));
  return statuses.map((status: BudgetStatus): BudgetRow => ({
    status,
    budgetId: ids.get(status.category.id) ?? null,
  }));
}

/**
 * How much of its limit a category has used, to one decimal. A $0 limit counts as fully used as
 * soon as anything is spent.
 *
 * @param status - The category's status line.
 */
export function usedPercent(status: BudgetStatus): number {
  if (status.budgetedAmount > 0) {
    return Math.round((status.spentAmount / status.budgetedAmount) * 1000) / 10;
  }
  return status.spentAmount > 0 ? 100 : 0;
}

/**
 * Decides which group a category belongs to, comparing whole cents so floating point noise cannot
 * flip it.
 *
 * @param status - The category's status line.
 */
export function groupKeyOf(status: BudgetStatus): BudgetGroupKey {
  const budgeted: number = cents(status.budgetedAmount);
  const spent: number = cents(status.spentAmount);
  if (spent > budgeted) return 'OVER';
  if (budgeted > 0 && spent * 100 >= budgeted * CLOSE_THRESHOLD_PERCENT) return 'CLOSE';
  return 'ON_TRACK';
}

const GROUP_LABELS: Record<BudgetGroupKey, BudgetRowGroup['label']> = {
  OVER: 'Over the limit',
  CLOSE: 'Close to the limit',
  ON_TRACK: 'On track',
  UNBUDGETED: 'No limit set',
};

/**
 * Splits rows into Over, Close, On track and No limit set (empty groups omitted), most used first
 * inside a group, then by name (No limit set is ordered by what was spent). A group's subtotal is
 * what is left across it, in cents (negative when over).
 *
 * @param rows - The month's rows.
 */
export function groupBudgetRows(rows: BudgetRow[]): BudgetRowGroup[] {
  const keys: BudgetGroupKey[] = ['OVER', 'CLOSE', 'ON_TRACK', 'UNBUDGETED'];
  const name = (row: BudgetRow): string => row.status.category.name;
  return keys
    .map((key: BudgetGroupKey): BudgetRowGroup => {
      const members: BudgetRow[] = rows
        .filter((row: BudgetRow): boolean =>
          key === 'UNBUDGETED'
            ? isUnbudgeted(row)
            : !isUnbudgeted(row) && groupKeyOf(row.status) === key,
        )
        .sort((a: BudgetRow, b: BudgetRow): number => {
          const byUse: number =
            key === 'UNBUDGETED'
              ? b.status.spentAmount - a.status.spentAmount
              : usedPercent(b.status) - usedPercent(a.status);
          return byUse || name(a).localeCompare(name(b), undefined, { sensitivity: 'base' });
        });
      return {
        key,
        label: GROUP_LABELS[key],
        leftSubtotal: toCents(
          members.reduce(
            (sum: number, row: BudgetRow): number =>
              sum + row.status.budgetedAmount - row.status.spentAmount,
            0,
          ),
        ),
        spentSubtotal: toCents(
          members.reduce((sum: number, row: BudgetRow): number => sum + row.status.spentAmount, 0),
        ),
        rows: members,
      };
    })
    .filter((group: BudgetRowGroup): boolean => group.rows.length > 0);
}

/**
 * Totals for the overview: what is budgeted, spent and left across budgeted categories, plus the
 * spending in categories with no budget (reported on its own so it cannot make the month look over).
 *
 * @param rows - The month's rows.
 */
export function budgetTotals(rows: BudgetRow[]): BudgetTotals {
  const budgetedRows: BudgetRow[] = rows.filter((row: BudgetRow): boolean => !isUnbudgeted(row));
  const budgeted: number = toCents(
    budgetedRows.reduce((sum: number, r: BudgetRow): number => sum + r.status.budgetedAmount, 0),
  );
  const spent: number = toCents(
    budgetedRows.reduce((sum: number, r: BudgetRow): number => sum + r.status.spentAmount, 0),
  );
  const unbudgeted: number = toCents(
    rows
      .filter(isUnbudgeted)
      .reduce((sum: number, r: BudgetRow): number => sum + r.status.spentAmount, 0),
  );
  return { budgeted, spent, left: toCents(budgeted - spent), unbudgeted };
}

/**
 * What copying last month's limits would do: add categories with no limit this month, and overwrite
 * categories whose limit differs. Categories budgeted only this month are never touched.
 *
 * @param last - Last month's budgets.
 * @param current - This month's budgets.
 */
export function copyPlan(
  last: Budget[],
  current: Budget[],
): { add: Budget[]; overwrite: Budget[] } {
  const now = new Map<number, number>(current.map((b: Budget) => [b.category.id, b.amount]));
  const add: Budget[] = last.filter((b: Budget): boolean => !now.has(b.category.id));
  const overwrite: Budget[] = last.filter(
    (b: Budget): boolean =>
      now.has(b.category.id) && cents(now.get(b.category.id)!) !== cents(b.amount),
  );
  return { add, overwrite };
}

/**
 * The categories that can still get a budget this month.
 *
 * @param categories - Every category.
 * @param budgets - This month's budgets.
 */
export function unbudgetedCategories(categories: Category[], budgets: Budget[]): Category[] {
  const used = new Set<number>(budgets.map((b: Budget): number => b.category.id));
  return categories.filter((c: Category): boolean => !used.has(c.id));
}

export const MONTH_NAMES: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The month's name (1 to 12). */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

/** "October 2026". */
export function monthLabel(month: number, year: number): string {
  return `${monthName(month)} ${year}`;
}

/**
 * Moves a month forwards or backwards, crossing year boundaries.
 *
 * @param month - 1 to 12.
 * @param year - The year.
 * @param delta - Months to move (negative for earlier).
 */
export function shiftMonth(
  month: number,
  year: number,
  delta: number,
): { month: number; year: number } {
  const index: number = year * 12 + (month - 1) + delta;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

/** Whether a month is the one `now` falls in. */
export function isSameMonth(month: number, year: number, now: Date = new Date()): boolean {
  return month === now.getMonth() + 1 && year === now.getFullYear();
}
