/** An inclusive date range expressed as `yyyy-mm-dd` strings. */
export interface DateRange {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;

const parse = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date): string => date.toISOString().split('T')[0];

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The window of the same inclusive length immediately before a range. Mirrors how
 * `DashboardService.getPulse` picks its comparison period for a date range.
 *
 * @param range - The current period.
 * @returns The preceding period of the same length in days.
 */
export function previousRange(range: DateRange): DateRange {
  const start: Date = parse(range.start);
  const days: number = Math.round((parse(range.end).getTime() - start.getTime()) / DAY_MS) + 1;
  return {
    start: toIso(new Date(start.getTime() - days * DAY_MS)),
    end: toIso(new Date(start.getTime() - DAY_MS)),
  };
}

/**
 * The whole calendar month for a month and year.
 *
 * @param month - The month, 1 to 12.
 * @param year - The four-digit year.
 */
export function monthRange(month: number, year: number): DateRange {
  return {
    start: toIso(new Date(Date.UTC(year, month - 1, 1))),
    end: toIso(new Date(Date.UTC(year, month, 0))),
  };
}

/**
 * The calendar month before a month and year, wrapping January to the prior December. Mirrors
 * how `DashboardService.getPulse` compares a custom month.
 *
 * @param month - The month, 1 to 12.
 * @param year - The four-digit year.
 */
export function previousMonthRange(month: number, year: number): DateRange {
  return month === 1 ? monthRange(12, year - 1) : monthRange(month - 1, year);
}

/**
 * A short human label for a range: "September 2026" for a full calendar month, otherwise
 * "Oct 1 to Oct 13, 2026" (or with both years when the range spans two).
 *
 * @param range - The range to label.
 */
export function formatRange(range: DateRange): string {
  const start: Date = parse(range.start);
  const end: Date = parse(range.end);
  const sameMonth: boolean =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  const lastDay: number = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();

  if (sameMonth && start.getUTCDate() === 1 && end.getUTCDate() === lastDay) {
    return MONTH_YEAR.format(start);
  }

  const startLabel: string =
    start.getUTCFullYear() === end.getUTCFullYear()
      ? SHORT_DATE.format(start)
      : SHORT_DATE_WITH_YEAR.format(start);
  return `${startLabel} to ${SHORT_DATE_WITH_YEAR.format(end)}`;
}

/**
 * The dashboard header's plain-language subtitle.
 *
 * @param current - The selected period.
 * @param previous - The period the backend compares it against.
 */
export function describePeriod(current: DateRange, previous: DateRange): string {
  return `${formatRange(current)} compared with ${formatRange(previous)}`;
}
