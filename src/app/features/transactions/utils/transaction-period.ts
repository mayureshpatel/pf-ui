import { TransactionFilter } from '@models/transaction.model';
import { toLocalDateString } from '@shared/utils/transaction.utils';

/** The period buttons above the transaction list. */
export type PeriodPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL_TIME' | 'CUSTOM';

/** A start and end date, each optional (no dates means all time). */
export interface PeriodRange {
  startDate?: Date;
  endDate?: Date;
}

/**
 * The whole calendar period a preset stands for, as local-midnight dates.
 *
 * @param preset - Any preset except CUSTOM (a custom range comes from the date pickers).
 * @param today - Today's date.
 * @returns The start and end dates, or an empty range for ALL_TIME.
 */
export function presetRange(preset: Exclude<PeriodPreset, 'CUSTOM'>, today: Date): PeriodRange {
  const year: number = today.getFullYear();
  const month: number = today.getMonth();
  switch (preset) {
    case 'THIS_MONTH':
      return { startDate: new Date(year, month, 1), endDate: new Date(year, month + 1, 0) };
    case 'LAST_MONTH':
      return { startDate: new Date(year, month - 1, 1), endDate: new Date(year, month, 0) };
    case 'THIS_YEAR':
      return { startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31) };
    case 'ALL_TIME':
      return {};
  }
}

const dayKey = (date: Date | undefined): string | undefined =>
  date ? toLocalDateString(date) : undefined;

/**
 * Which preset a date range corresponds to. Ranges are compared by calendar day, so a date picker
 * that leaves a time of day on the value still matches.
 *
 * @param range - The current start and end dates.
 * @param today - Today's date.
 * @returns The matching preset, or CUSTOM when none matches.
 */
export function detectPreset(range: PeriodRange, today: Date): PeriodPreset {
  if (!range.startDate && !range.endDate) return 'ALL_TIME';
  const presets: Exclude<PeriodPreset, 'CUSTOM' | 'ALL_TIME'>[] = [
    'THIS_MONTH',
    'LAST_MONTH',
    'THIS_YEAR',
  ];
  for (const preset of presets) {
    const candidate: PeriodRange = presetRange(preset, today);
    if (
      dayKey(candidate.startDate) === dayKey(range.startDate) &&
      dayKey(candidate.endDate) === dayKey(range.endDate)
    ) {
      return preset;
    }
  }
  return 'CUSTOM';
}

/**
 * Whether any filter field is set. The page defaults to This month only when the URL carries no
 * filter at all, so a deep link such as `?categoryName=null` shows everything that matches.
 *
 * @param filter - The filter to inspect.
 */
export function hasAnyFilter(filter: TransactionFilter): boolean {
  // null is what a cleared number input reports, and it is not an applied filter either
  return Object.values(filter).some(
    (value: unknown): boolean => value !== undefined && value !== null,
  );
}

/**
 * Whether the filter is a date range and nothing else. An empty list under such a filter may only
 * mean "nothing in this period", so the page checks whether anything exists before saying so.
 *
 * @param filter - The filter to inspect.
 */
export function hasOnlyPeriodFilter(filter: TransactionFilter): boolean {
  const { startDate, endDate, ...rest } = filter;
  return (startDate != null || endDate != null) && !hasAnyFilter(rest);
}

const MONTH_NAME = new Intl.DateTimeFormat('en-US', { month: 'long' });

/**
 * The headline for an empty list when the period is the only filter and older transactions exist.
 * A period that has not ended yet reads "yet"; a past one does not.
 *
 * @param range - The applied date range.
 * @param today - Today's date.
 * @returns For example "No transactions in October yet".
 */
export function describeEmptyPeriod(range: PeriodRange, today: Date): string {
  switch (detectPreset(range, today)) {
    case 'THIS_MONTH':
      return `No transactions in ${MONTH_NAME.format(today)} yet`;
    case 'LAST_MONTH':
      return `No transactions in ${MONTH_NAME.format(presetRange('LAST_MONTH', today).startDate)}`;
    case 'THIS_YEAR':
      return `No transactions in ${today.getFullYear()} yet`;
    default:
      return 'No transactions in this date range';
  }
}
