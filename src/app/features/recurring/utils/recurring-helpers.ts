import { PriceChange, RecurringFrequency, RecurringTransaction } from '@models/recurring.model';

export type RecurringGroupKey = RecurringFrequency | 'PAUSED';

/** One block of the list: a frequency (or the paused items) with its monthly-equivalent cost. */
export interface RecurringGroup {
  key: RecurringGroupKey;
  label: string;
  items: RecurringTransaction[];
  /** The group's monthly-equivalent cost; null for the paused group. */
  monthlyTotal: number | null;
}

export interface RecurringTotals {
  monthly: number;
  yearly: number;
  services: number;
}

export const FREQUENCY_ORDER: RecurringFrequency[] = [
  'WEEKLY',
  'BI_WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

const PER_MONTH: Record<RecurringFrequency, number> = {
  WEEKLY: 52 / 12,
  BI_WEEKLY: 26 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  YEARLY: 1 / 12,
};

const toCents = (value: number): number => Math.round(value * 100) / 100;

const exactMonthly = (item: RecurringTransaction): number =>
  item.amount * PER_MONTH[item.frequency];

/** Where the next charge is expected: the projected date when the server gave one, else the stored one. */
export const nextDateOf = (item: RecurringTransaction): string =>
  item.projectedNextDate ?? item.nextDate;

const byNextDate = (a: RecurringTransaction, b: RecurringTransaction): number =>
  nextDateOf(a).localeCompare(nextDateOf(b));

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

/** Parses a yyyy-MM-dd string as a local calendar date (never through UTC). */
const parseDay = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDay = (value: string, now: Date): string => {
  const date: Date = parseDay(value);
  const text: string = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    date,
  );
  return date.getFullYear() === now.getFullYear() ? text : `${text}, ${date.getFullYear()}`;
};

/**
 * What an amount costs per month at a frequency, rounded to cents.
 * @param amount the amount per payment.
 * @param frequency how often it is paid.
 * @returns the monthly equivalent.
 */
export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  return toCents(amount * PER_MONTH[frequency]);
}

/**
 * Splits tracked items into one group per frequency (empty ones omitted, weekly to yearly) with the
 * paused items last. Items inside a group are ordered by when they are next expected.
 * @param items the tracked items.
 * @returns the groups to show.
 */
export function groupByFrequency(items: RecurringTransaction[]): RecurringGroup[] {
  const groups: RecurringGroup[] = [];
  for (const frequency of FREQUENCY_ORDER) {
    const members: RecurringTransaction[] = items
      .filter((i: RecurringTransaction): boolean => i.active && i.frequency === frequency)
      .sort(byNextDate);
    if (members.length > 0) {
      groups.push({
        key: frequency,
        label: FREQUENCY_LABELS[frequency],
        items: members,
        monthlyTotal: toCents(members.reduce((sum: number, i) => sum + exactMonthly(i), 0)),
      });
    }
  }
  const paused: RecurringTransaction[] = items
    .filter((i: RecurringTransaction): boolean => !i.active)
    .sort(byNextDate);
  if (paused.length > 0) {
    groups.push({ key: 'PAUSED', label: 'Paused', items: paused, monthlyTotal: null });
  }
  return groups;
}

/**
 * What the active items cost per month and per year, and how many there are.
 * @param items the tracked items; paused ones are ignored.
 * @returns the totals.
 */
export function totals(items: RecurringTransaction[]): RecurringTotals {
  const active: RecurringTransaction[] = items.filter(
    (i: RecurringTransaction): boolean => i.active,
  );
  const monthly: number = active.reduce((sum: number, i) => sum + exactMonthly(i), 0);
  return { monthly: toCents(monthly), yearly: toCents(monthly * 12), services: active.length };
}

/**
 * The next few charges by date. Paused items and overdue ones (whose date has already passed) are left out.
 * @param items the tracked items.
 * @param limit how many to return.
 * @returns the soonest items.
 */
export function comingUp(items: RecurringTransaction[], limit = 3): RecurringTransaction[] {
  return items
    .filter((i: RecurringTransaction): boolean => i.active && !i.overdue)
    .sort(byNextDate)
    .slice(0, limit);
}

/**
 * A word for how sure the detection is.
 * @param score the 0-100 confidence score.
 * @returns High from 70 up, otherwise Medium.
 */
export function confidenceLabel(score: number): 'High' | 'Medium' {
  return score >= 70 ? 'High' : 'Medium';
}

/**
 * The note shown under an item whose price changed.
 * @param change the price change.
 * @param now today, to decide whether the year is worth showing.
 * @returns for example "Was $10.00, now $12.00 since Sep 3".
 */
export function priceChangeText(change: PriceChange, now: Date = new Date()): string {
  return `Was ${formatMoney(change.previousAmount)}, now ${formatMoney(change.newAmount)} since ${formatDay(change.since, now)}`;
}

/**
 * The text that replaces an item's next date when its charge is late.
 * @param item the tracked item.
 * @param now today, to decide whether the year is worth showing.
 * @returns for example "Expected Oct 28", or null when the item is not overdue.
 */
export function expectedText(item: RecurringTransaction, now: Date = new Date()): string | null {
  return item.overdue ? `Expected ${formatDay(nextDateOf(item), now)}` : null;
}

/**
 * Formats a yyyy-MM-dd date for the list ("Nov 3", with the year when it is another year).
 * @param value the date string.
 * @param now today.
 * @returns the short date.
 */
export function shortDate(value: string, now: Date = new Date()): string {
  return formatDay(value, now);
}
